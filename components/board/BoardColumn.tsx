'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Trash2 } from 'lucide-react'
import { BoardCard } from './BoardCard'
import { CreateCardDialog } from './CreateCardDialog'
import { deleteColumn } from '@/actions/columns'
import { useTransition } from 'react'
import type { Column, Card } from '@/lib/types'

interface BoardColumnProps {
  column: Column
  cards: Card[]
  boardId: string
  userId: string
  isTeacher?: boolean
  commentCounts?: Record<string, number>
  linkCounts?: Record<string, number>
  /** Все колонки доски — для меню «Переместить в колонку» на карточках. */
  columns: Column[]
  onMoveCard: (cardId: string, targetColumnId: string) => void
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<{ error?: string } | void>
  onCommentCountChange?: (cardId: string, count: number) => void
  onLinkCountChange?: (cardId: string, count: number) => void
}

export function BoardColumn({
  column,
  cards,
  boardId,
  userId,
  isTeacher = false,
  commentCounts = {},
  linkCounts = {},
  columns,
  onMoveCard,
  onUpdateCard,
  onCommentCountChange,
  onLinkCountChange,
}: BoardColumnProps) {
  const t = useTranslations('board')
  const [showCreateCard, setShowCreateCard] = useState(false)
  const [isPending, startTransition] = useTransition()

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column },
  })

  const sortedCards = [...cards].sort((a, b) => a.position - b.position)

  function handleDeleteColumn() {
    if (!confirm(t('confirmDeleteColumn'))) return
    startTransition(async () => {
      await deleteColumn(column.id, boardId)
    })
  }

  return (
    <div className="shrink-0 w-[280px] sm:w-72 snap-start">
      <div className="bg-gray-100/80 border border-gray-200/70 rounded-2xl p-3 transition-colors hover:border-gray-300">
        {/* Column header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800 text-sm">{column.title}</h3>
            <span className="bg-gray-200 text-gray-600 rounded-full text-xs px-2 py-0.5 font-semibold tabular-nums">
              {cards.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowCreateCard(true)}
              className="p-1 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-white transition-colors"
              title={t('addCard')}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={handleDeleteColumn}
              disabled={isPending}
              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white transition-colors"
              title={t('deleteColumn')}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Cards drop zone */}
        <div
          ref={setNodeRef}
          className={`space-y-2 min-h-[8px] rounded-xl transition-colors ${
            isOver ? 'bg-brand-50 ring-2 ring-inset ring-brand-200' : ''
          }`}
        >
          <SortableContext
            items={sortedCards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedCards.map((card) => (
              <BoardCard
                key={card.id}
                card={card}
                boardId={boardId}
                userId={userId}
                isTeacher={isTeacher}
                commentsCount={commentCounts[card.id] ?? 0}
                linksCount={linkCounts[card.id] ?? 0}
                columns={columns}
                onMoveCard={onMoveCard}
                onUpdateCard={onUpdateCard}
                onCommentCountChange={onCommentCountChange}
                onLinkCountChange={onLinkCountChange}
              />
            ))}
          </SortableContext>
        </div>

        {/* Add card button */}
        <button
          onClick={() => setShowCreateCard(true)}
          className="mt-2 w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 hover:bg-white transition-colors"
        >
          <Plus size={15} />
          {t('addCard')}
        </button>
      </div>

      <CreateCardDialog
        open={showCreateCard}
        onClose={() => setShowCreateCard(false)}
        columnId={column.id}
        boardId={boardId}
      />
    </div>
  )
}
