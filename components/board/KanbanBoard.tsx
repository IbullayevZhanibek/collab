'use client'

import { useState, useEffect, useTransition } from 'react'
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
import { Plus } from 'lucide-react'
import { BoardColumn } from './BoardColumn'
import { BoardCard } from './BoardCard'
import { CreateColumnDialog } from './CreateColumnDialog'
import { reorderCards, moveCard, updateCard } from '@/actions/cards'
import { updateColumnTitle } from '@/actions/columns'
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

  // Синхронизируем серверные props в локальное состояние, когда сервер
  // присылает новые данные (после revalidatePath / навигации). Делаем это
  // прямо во время рендера (рекомендованный React паттерн вместо
  // useEffect + setState), сравнивая ссылку на пришедший prop.
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

  // Загрузка счётчиков комментариев и ссылок по всем карточкам (по одному запросу).
  useEffect(() => {
    if (!cards.length) return
    const ids = cards.map((c) => c.id)
    getBulkCommentsCounts(ids).then(({ data }) => { if (data) setCommentCounts(data) })
    getBulkLinksCounts(ids).then(({ data }) => { if (data) setLinkCounts(data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // только при монтировании; далее обновляется через realtime

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const cardsChannel = supabase
      .channel(`board-${boardId}-cards`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCards((prev) => {
              if (prev.find((c) => c.id === (payload.new as Card).id)) return prev
              return [...prev, payload.new as Card]
            })
          } else if (payload.eventType === 'UPDATE') {
            setCards((prev) =>
              prev.map((c) => (c.id === (payload.new as Card).id ? (payload.new as Card) : c))
            )
          } else if (payload.eventType === 'DELETE') {
            setCards((prev) => prev.filter((c) => c.id !== (payload.old as Card).id))
          }
        }
      )
      .subscribe()

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
              prev.map((c) => c.id === (payload.new as Column).id ? { ...c, ...(payload.new as Column) } : c)
            )
          } else if (payload.eventType === 'DELETE') {
            setColumns((prev) => prev.filter((c) => c.id !== (payload.old as Column).id))
            setCards((prev) => prev.filter((c) => c.column_id !== (payload.old as Column).id))
          }
        }
      )
      .subscribe()

    // Обновляем счётчики комментариев в реальном времени.
    const commentsChannel = supabase
      .channel(`board-${boardId}-comments`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        (payload) => {
          const cardId = (payload.new as { card_id: string }).card_id
          setCommentCounts((prev) => ({ ...prev, [cardId]: (prev[cardId] ?? 0) + 1 }))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments' },
        (payload) => {
          const cardId = (payload.old as { card_id: string }).card_id
          setCommentCounts((prev) => ({
            ...prev,
            [cardId]: Math.max(0, (prev[cardId] ?? 0) - 1),
          }))
        },
      )
      .subscribe()

    // Обновляем счётчики ссылок в реальном времени.
    const linksChannel = supabase
      .channel(`board-${boardId}-links`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'card_links' },
        (payload) => {
          const cardId = (payload.new as { card_id: string }).card_id
          setLinkCounts((prev) => ({ ...prev, [cardId]: (prev[cardId] ?? 0) + 1 }))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'card_links' },
        (payload) => {
          const cardId = (payload.old as { card_id: string }).card_id
          setLinkCounts((prev) => ({
            ...prev,
            [cardId]: Math.max(0, (prev[cardId] ?? 0) - 1),
          }))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(cardsChannel)
      supabase.removeChannel(columnsChannel)
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(linksChannel)
    }
  }, [boardId])

  function handleCommentCountChange(cardId: string, count: number) {
    setCommentCounts((prev) => ({ ...prev, [cardId]: count }))
  }

  function handleLinkCountChange(cardId: string, count: number) {
    setLinkCounts((prev) => ({ ...prev, [cardId]: count }))
  }

  function getColumnCards(columnId: string) {
    return cards
      .filter((c) => c.column_id === columnId)
      .sort((a, b) => a.position - b.position)
  }

  // Перемещение карточки через меню (мобильная альтернатива drag&drop):
  // ставим карточку в конец целевой колонки, оптимистично обновляем состояние,
  // затем фиксируем на сервере (realtime подтвердит/скорректирует).
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

  // Сохранение правок из диалога деталей: оптимистично применяем изменения,
  // затем пишем на сервер. При ошибке откатываем к снимку «до».
  async function handleUpdateCard(cardId: string, updates: Partial<Card>) {
    const snapshot = cards
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)))
    const result = await updateCard(cardId, boardId, updates)
    if (result?.error) setCards(snapshot)
    return result
  }

  async function handleRenameColumn(columnId: string, newTitle: string) {
    const snapshot = columns
    setColumns((prev) => prev.map((c) => c.id === columnId ? { ...c, title: newTitle } : c))
    const result = await updateColumnTitle(columnId, newTitle, boardId)
    if (result?.error) setColumns(snapshot)
  }

  function onDragStart(event: DragStartEvent) {
    const { active } = event
    if (active.data.current?.type === 'card') {
      setActiveCard(active.data.current.card)
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

    // Card over another card
    if (isActiveCard && isOverCard) {
      setCards((prev) => {
        const activeIdx = prev.findIndex((c) => c.id === activeId)
        const overIdx = prev.findIndex((c) => c.id === overId)
        const activeCard = prev[activeIdx]
        const overCard = prev[overIdx]

        if (activeCard.column_id !== overCard.column_id) {
          const updated = prev.map((c) =>
            c.id === activeId ? { ...c, column_id: overCard.column_id } : c
          )
          return arrayMove(updated, activeIdx, overIdx - 1)
        }
        return arrayMove(prev, activeIdx, overIdx)
      })
    }

    // Card over column (empty)
    if (isActiveCard && isOverColumn) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, column_id: overId } : c
        )
      )
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string

    if (active.data.current?.type === 'card') {
      // Persist positions
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
              onCommentCountChange={handleCommentCountChange}
              onLinkCountChange={handleLinkCountChange}
            />
          ))}
        </SortableContext>

        {/* Add column — full-width on mobile, fixed-width column on desktop */}
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
      />
    </DndContext>
  )
}
