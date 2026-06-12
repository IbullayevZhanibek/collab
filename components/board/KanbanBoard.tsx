'use client'

import { useState, useEffect, useTransition } from 'react'
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
import { reorderCards } from '@/actions/cards'
import { createClient } from '@/lib/supabase/client'
import type { Column, Card } from '@/lib/types'

interface KanbanBoardProps {
  boardId: string
  userId: string
  initialColumns: Column[]
  initialCards: Card[]
}

export function KanbanBoard({ boardId, userId, initialColumns, initialCards }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>(
    [...initialColumns].sort((a, b) => a.position - b.position)
  )
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [showCreateColumn, setShowCreateColumn] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Sync server-fetched props into local state whenever router.refresh() delivers
  // new data from the Server Component. useState(initial) only runs at mount,
  // so without this effect new items never appear after creation.
  useEffect(() => {
    setColumns([...initialColumns].sort((a, b) => a.position - b.position))
  }, [initialColumns])

  useEffect(() => {
    setCards(initialCards)
  }, [initialCards])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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
          } else if (payload.eventType === 'DELETE') {
            setColumns((prev) => prev.filter((c) => c.id !== (payload.old as Column).id))
            setCards((prev) => prev.filter((c) => c.column_id !== (payload.old as Column).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(cardsChannel)
      supabase.removeChannel(columnsChannel)
    }
  }, [boardId])

  function getColumnCards(columnId: string) {
    return cards
      .filter((c) => c.column_id === columnId)
      .sort((a, b) => a.position - b.position)
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
      <div className="flex gap-3 sm:gap-4 items-start overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth scrollbar-thin">
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
            />
          ))}
        </SortableContext>

        {/* Add column */}
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowCreateColumn(true)}
            className="flex items-center gap-2 bg-white/70 hover:bg-white border-2 border-dashed border-gray-300 hover:border-brand-400 rounded-2xl px-5 py-3 text-sm font-medium text-gray-500 hover:text-brand-600 transition-all w-[280px] sm:w-72 snap-start shrink-0"
          >
            <Plus size={16} />
            Добавить колонку
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
