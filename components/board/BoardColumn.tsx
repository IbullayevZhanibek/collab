'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { BoardCard } from './BoardCard'
import { CreateCardDialog } from './CreateCardDialog'
import { deleteColumn } from '@/actions/columns'
import type { Column, Card, MemberWithProfile } from '@/lib/types'

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
  members?: MemberWithProfile[]
  onMoveCard: (cardId: string, targetColumnId: string) => void
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<{ error?: string } | void>
  onRenameColumn?: (columnId: string, newTitle: string) => Promise<void>
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
  members = [],
  onMoveCard,
  onUpdateCard,
  onRenameColumn,
  onCommentCountChange,
  onLinkCountChange,
}: BoardColumnProps) {
  const t = useTranslations('board')
  const [showCreateCard, setShowCreateCard] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Inline rename state
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(column.title)

  // Sync draft when column.title is reverted externally (e.g. optimistic rollback)
  const [prevTitle, setPrevTitle] = useState(column.title)
  if (column.title !== prevTitle && !editing) {
    setPrevTitle(column.title)
    setDraft(column.title)
  }

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

  function startEditing() {
    setDraft(column.title)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setDraft(column.title)
  }

  function commitEditing() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === column.title) {
      cancelEditing()
      return
    }
    setEditing(false)
    onRenameColumn?.(column.id, trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEditing()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  return (
    <div className="shrink-0 w-[280px] sm:w-72 snap-start">
      <div className="bg-gray-100/80 border border-gray-200/70 rounded-2xl p-3 transition-colors hover:border-gray-300">
        {/* Column header */}
        <div className="flex items-center justify-between mb-3 px-1">

          {/* Title / inline input */}
          <div className="group/col flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={commitEditing}
                placeholder={t('columnNamePlaceholder')}
                className="font-semibold text-gray-800 text-sm bg-white border border-brand-300 rounded-md px-1.5 py-0.5 w-full outline-none focus:ring-2 focus:ring-brand-400/30"
              />
            ) : (
              <>
                <h3
                  className="font-semibold text-gray-800 text-sm truncate select-none"
                  onDoubleClick={onRenameColumn ? startEditing : undefined}
                >
                  {column.title}
                </h3>
                <span className="bg-gray-200 text-gray-600 rounded-full text-xs px-2 py-0.5 font-semibold tabular-nums shrink-0">
                  {cards.length}
                </span>
                {onRenameColumn && (
                  <button
                    onClick={startEditing}
                    className="p-0.5 rounded text-gray-400 hover:text-brand-500 transition-colors
                               opacity-100 sm:opacity-0 sm:group-hover/col:opacity-100"
                    title={t('renameColumn')}
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Action buttons — hidden while editing */}
          {!editing && (
            <div className="flex items-center gap-1 shrink-0">
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
          )}
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
                members={members}
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
        currentUserId={userId}
        members={members}
      />
    </div>
  )
}
