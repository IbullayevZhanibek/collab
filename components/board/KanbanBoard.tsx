'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Plus, X } from 'lucide-react'
import { BoardColumn } from './BoardColumn'
import { BoardCard } from './BoardCard'
import { CreateColumnDialog } from './CreateColumnDialog'
import { reorderCards, moveCard, updateCard, deleteCard } from '@/actions/cards'
import { deleteColumn, updateColumnTitle } from '@/actions/columns'
import { getBulkCommentsCounts } from '@/actions/comments'
import { getBulkLinksCounts } from '@/actions/card_links'
import { createClient } from '@/lib/supabase/client'
import type { Column, Card, MemberWithProfile } from '@/lib/types'

interface KanbanBoardProps {
  boardId: string
  userId: string
  isOwner?: boolean
  initialColumns: Column[]
  initialCards: Card[]
  members?: MemberWithProfile[]
}

export function KanbanBoard({ boardId, userId, isOwner = false, initialColumns, initialCards, members = [] }: KanbanBoardProps) {
  const t = useTranslations('board')
  const [columns, setColumns] = useState<Column[]>(
    [...initialColumns].sort((a, b) => a.position - b.position)
  )
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [showCreateColumn, setShowCreateColumn] = useState(false)
  const [, startTransition] = useTransition()
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [linkCounts, setLinkCounts] = useState<Record<string, number>>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Refs for use inside realtime callbacks (avoid stale closures).
  const columnIdsRef = useRef(new Set<string>())
  columnIdsRef.current = new Set(columns.map((c) => c.id))

  // Sync server props → local state on navigation / revalidation.
  const [prevColumns, setPrevColumns] = useState(initialColumns)
  if (initialColumns !== prevColumns) {
    setPrevColumns(initialColumns)
    setColumns([...initialColumns].sort((a, b) => a.position - b.position))
  }
  const [prevCards, setPrevCards] = useState(initialCards)
  if (initialCards !== prevCards) {
    setPrevCards(initialCards)
    setCards(initialCards)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ── Toast ───────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToastMsg(msg)
  }
  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 3500)
    return () => clearTimeout(t)
  }, [toastMsg])

  // ── Initial bulk counts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!cards.length) return
    const ids = cards.map((c) => c.id)
    getBulkCommentsCounts(ids).then(({ data }) => { if (data) setCommentCounts(data) })
    getBulkLinksCounts(ids).then(({ data }) => { if (data) setLinkCounts(data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // once on mount; realtime keeps them live afterwards

  // ── Realtime subscriptions ────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    // Cards — filter client-side to this board's columns only.
    const cardsChannel = supabase
      .channel(`board-${boardId}-cards`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        (payload) => {
          // Ignore events for cards that don't belong to this board's columns.
          const colId =
            payload.eventType !== 'DELETE'
              ? (payload.new as Card).column_id
              : (payload.old as { column_id: string }).column_id
          if (!columnIdsRef.current.has(colId)) return

          if (payload.eventType === 'INSERT') {
            setCards((prev) => {
              if (prev.find((c) => c.id === (payload.new as Card).id)) return prev
              return [...prev, payload.new as Card]
            })
          } else if (payload.eventType === 'UPDATE') {
            setCards((prev) =>
              prev.map((c) =>
                c.id === (payload.new as Card).id
                  ? { ...c, ...(payload.new as Card) }
                  : c
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setCards((prev) => prev.filter((c) => c.id !== (payload.old as Card).id))
          }
        }
      )
      .subscribe()

    // Columns — filtered server-side by board_id.
    const columnsChannel = supabase
      .channel(`board-${boardId}-columns`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setColumns((prev) => {
              if (prev.find((c) => c.id === (payload.new as Column).id)) return prev
              return [...prev, payload.new as Column].sort((a, b) => a.position - b.position)
            })
          } else if (payload.eventType === 'UPDATE') {
            setColumns((prev) =>
              prev.map((c) =>
                c.id === (payload.new as Column).id ? { ...c, ...(payload.new as Column) } : c
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setColumns((prev) => prev.filter((c) => c.id !== (payload.old as Column).id))
            setCards((prev) => prev.filter((c) => c.column_id !== (payload.old as Column).id))
          }
        }
      )
      .subscribe()

    // Comment counters.
    const commentsChannel = supabase
      .channel(`board-${boardId}-comments`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const cardId = (payload.new as { card_id: string }).card_id
        setCommentCounts((prev) => ({ ...prev, [cardId]: (prev[cardId] ?? 0) + 1 }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload) => {
        const cardId = (payload.old as { card_id: string }).card_id
        setCommentCounts((prev) => ({ ...prev, [cardId]: Math.max(0, (prev[cardId] ?? 0) - 1) }))
      })
      .subscribe()

    // Link counters.
    const linksChannel = supabase
      .channel(`board-${boardId}-links`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'card_links' }, (payload) => {
        const cardId = (payload.new as { card_id: string }).card_id
        setLinkCounts((prev) => ({ ...prev, [cardId]: (prev[cardId] ?? 0) + 1 }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'card_links' }, (payload) => {
        const cardId = (payload.old as { card_id: string }).card_id
        setLinkCounts((prev) => ({ ...prev, [cardId]: Math.max(0, (prev[cardId] ?? 0) - 1) }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(cardsChannel)
      supabase.removeChannel(columnsChannel)
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(linksChannel)
    }
  }, [boardId])

  // ── Optimistic helpers ───────────────────────────────────────────────────────
  const handleCommentCountChange = useCallback((cardId: string, count: number) => {
    setCommentCounts((prev) => ({ ...prev, [cardId]: count }))
  }, [])

  const handleLinkCountChange = useCallback((cardId: string, count: number) => {
    setLinkCounts((prev) => ({ ...prev, [cardId]: count }))
  }, [])

  // Called by CreateCardDialog after server-side creation — instant UI, deduped by realtime.
  const handleCardCreated = useCallback((card: Card) => {
    setCards((prev) => {
      if (prev.find((c) => c.id === card.id)) return prev
      return [...prev, card]
    })
  }, [])

  // Called by CreateColumnDialog — instant UI, deduped by realtime.
  const handleColumnCreated = useCallback((column: Column) => {
    setColumns((prev) => {
      if (prev.find((c) => c.id === column.id)) return prev
      return [...prev, column].sort((a, b) => a.position - b.position)
    })
  }, [])

  // Optimistic card delete with rollback on error.
  const handleDeleteCard = useCallback(async (cardId: string) => {
    const snapshot = cards
    setCards((prev) => prev.filter((c) => c.id !== cardId))
    const result = await deleteCard(cardId, boardId)
    if (result?.error) {
      setCards(snapshot)
      showToast(result.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, boardId])

  // Optimistic column delete with rollback on error.
  const handleDeleteColumn = useCallback(async (columnId: string) => {
    const snapshotCols = columns
    const snapshotCards = cards
    setColumns((prev) => prev.filter((c) => c.id !== columnId))
    setCards((prev) => prev.filter((c) => c.column_id !== columnId))
    const result = await deleteColumn(columnId, boardId)
    if (result?.error) {
      setColumns(snapshotCols)
      setCards(snapshotCards)
      showToast(result.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, cards, boardId])

  function getColumnCards(columnId: string) {
    return cards
      .filter((c) => c.column_id === columnId)
      .sort((a, b) => a.position - b.position)
  }

  function handleMoveCard(cardId: string, targetColumnId: string) {
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.column_id === targetColumnId) return

    const targetPosition = cards.filter((c) => c.column_id === targetColumnId).length

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, column_id: targetColumnId, position: targetPosition } : c
      )
    )

    startTransition(async () => {
      await moveCard(cardId, targetColumnId, targetPosition, boardId)
    })
  }

  async function handleUpdateCard(cardId: string, updates: Partial<Card>) {
    const snapshot = cards
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)))
    const result = await updateCard(cardId, boardId, updates)
    if (result?.error) {
      setCards(snapshot)
      showToast(result.error)
    }
    return result
  }

  async function handleRenameColumn(columnId: string, newTitle: string) {
    const snapshot = columns
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, title: newTitle } : c)))
    const result = await updateColumnTitle(columnId, newTitle, boardId)
    if (result?.error) {
      setColumns(snapshot)
      showToast(result.error)
    }
  }

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'card') {
      setActiveCard(event.active.data.current.card)
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const isActiveCard = active.data.current?.type === 'card'
    const isOverCard = over.data.current?.type === 'card'
    const isOverColumn = over.data.current?.type === 'column'

    if (!isActiveCard) return

    if (isActiveCard && isOverCard) {
      setCards((prev) => {
        const activeIdx = prev.findIndex((c) => c.id === activeId)
        const overIdx = prev.findIndex((c) => c.id === overId)
        const aCard = prev[activeIdx]
        const oCard = prev[overIdx]
        if (aCard.column_id !== oCard.column_id) {
          const updated = prev.map((c) =>
            c.id === activeId ? { ...c, column_id: oCard.column_id } : c
          )
          return arrayMove(updated, activeIdx, overIdx - 1)
        }
        return arrayMove(prev, activeIdx, overIdx)
      })
    }

    if (isActiveCard && isOverColumn) {
      setCards((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, column_id: overId } : c))
      )
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    if (!event.over) return

    if (event.active.data.current?.type === 'card') {
      const updatedCards = cards.map((c, i) => ({ ...c, position: i }))
      startTransition(async () => {
        await reorderCards(
          boardId,
          updatedCards.map((c) => ({ id: c.id, position: c.position, column_id: c.column_id }))
        )
      })
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {/*
          Mobile  (< lg): flex-col — columns stack vertically, full-width, no h-scroll.
          Desktop (lg+):  flex-row — original horizontal kanban with h-scroll.
        */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4 lg:overflow-x-auto lg:pb-4 lg:snap-x lg:snap-mandatory lg:scroll-smooth lg:scrollbar-thin">
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={getColumnCards(column.id)}
                boardId={boardId}
                userId={userId}
                isTeacher={isOwner}
                commentCounts={commentCounts}
                linkCounts={linkCounts}
                columns={columns}
                members={members}
                onMoveCard={handleMoveCard}
                onUpdateCard={handleUpdateCard}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumn}
                onCardCreated={handleCardCreated}
                onDeleteCard={handleDeleteCard}
                onCommentCountChange={handleCommentCountChange}
                onLinkCountChange={handleLinkCountChange}
              />
            ))}
          </SortableContext>

          {/* Add column button */}
          <div className="lg:shrink-0">
            <button
              onClick={() => setShowCreateColumn(true)}
              className="w-full lg:w-72 flex items-center gap-2 bg-white/70 hover:bg-white border-2 border-dashed border-gray-300 hover:border-brand-400 rounded-2xl px-5 py-3 text-sm font-medium text-gray-500 hover:text-brand-600 transition-all lg:snap-start lg:shrink-0"
            >
              <Plus size={16} />
              {t('addColumn')}
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="rotate-2 shadow-xl opacity-90">
              <BoardCard card={activeCard} boardId={boardId} userId={userId} />
            </div>
          )}
        </DragOverlay>

        <CreateColumnDialog
          open={showCreateColumn}
          onClose={() => setShowCreateColumn(false)}
          boardId={boardId}
          onCreated={handleColumnCreated}
        />
      </DndContext>

      {/* Error toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl max-w-sm w-max animate-in slide-in-from-bottom-4">
          <span>{toastMsg}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}
