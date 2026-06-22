'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Trash2, Pencil, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BoardCard } from './BoardCard'
import { CreateCardDialog } from './CreateCardDialog'
import type { Column, Card, MemberWithProfile } from '@/lib/types'

interface BoardColumnProps {
  column: Column
  cards: Card[]
  boardId: string
  userId: string
  isTeacher?: boolean
  commentCounts?: Record<string, number>
  linkCounts?: Record<string, number>
  columns: Column[]
  members?: MemberWithProfile[]
  onMoveCard: (cardId: string, targetColumnId: string) => void
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<{ error?: string } | void>
  onRenameColumn?: (columnId: string, newTitle: string) => void
  onDeleteColumn?: (columnId: string) => void
  onCardCreated: (card: Card) => void
  onDeleteCard: (cardId: string) => void
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
  onDeleteColumn,
  onCardCreated,
  onDeleteCard,
  onCommentCountChange,
  onLinkCountChange,
}: BoardColumnProps) {
  const t = useTranslations('board')
  const [showCreateCard, setShowCreateCard] = useState(false)

  // Inline rename
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(column.title)
  const [prevTitle, setPrevTitle] = useState(column.title)
  if (column.title !== prevTitle && !editing) {
    setPrevTitle(column.title)
    setDraft(column.title)
  }

  // Mobile accordion — expanded by default, desktop always open (lg:block override)
  const [collapsed, setCollapsed] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column },
  })

  const sortedCards = [...cards].sort((a, b) => a.position - b.position)

  function handleDeleteColumn() {
    if (!confirm(t('confirmDeleteColumn'))) return
    onDeleteColumn?.(column.id)
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
    if (!trimmed || trimmed === column.title) { cancelEditing(); return }
    setEditing(false)
    onRenameColumn?.(column.id, trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitEditing() }
    else if (e.key === 'Escape') cancelEditing()
  }

  return (
    /*
      Mobile  (< lg): w-full — column spans full viewport width.
      Desktop (lg+):  shrink-0 w-72 — fixed-width column in horizontal row.
    */
    <div className="w-full lg:shrink-0 lg:w-72 lg:snap-start">
      <div className="bg-gray-100/80 border border-gray-200/70 rounded-2xl p-3 transition-colors hover:border-gray-300">

        {/* ── Column header ── */}
        <div className="flex items-center gap-1 mb-3 px-1">

          {/* Title + collapse toggle (mobile) + rename pencil */}
          <div className="group/col flex items-center gap-1.5 min-w-0 flex-1 mr-1">
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
                {/*
                  Mobile: tap on title area to collapse/expand.
                  Desktop (lg): pointer-events-none so it doesn't collapse on click.
                  onDoubleClick for rename still works because it's on the <h3>.
                */}
                <button
                  type="button"
                  onClick={() => setCollapsed((v) => !v)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left lg:pointer-events-none"
                  aria-expanded={!collapsed}
                  title={collapsed ? t('expandColumn') : t('collapseColumn')}
                >
                  <ChevronDown
                    size={14}
                    className={cn(
                      'shrink-0 text-gray-400 transition-transform duration-200 lg:hidden',
                      collapsed && '-rotate-90'
                    )}
                  />
                  <h3
                    className="font-semibold text-gray-800 text-sm truncate select-none"
                    onDoubleClick={onRenameColumn ? startEditing : undefined}
                  >
                    {column.title}
                  </h3>
                </button>

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

          {/* Action buttons (+ card, delete) — larger tap targets on mobile */}
          {!editing && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => setShowCreateCard(true)}
                className="p-2 lg:p-1 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-white transition-colors"
                title={t('addCard')}
              >
                <Plus size={17} className="lg:hidden" />
                <Plus size={15} className="hidden lg:block" />
              </button>
              {onDeleteColumn && (
                <button
                  onClick={handleDeleteColumn}
                  className="p-2 lg:p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white transition-colors"
                  title={t('deleteColumn')}
                >
                  <Trash2 size={16} className="lg:hidden" />
                  <Trash2 size={14} className="hidden lg:block" />
                </button>
              )}
            </div>
          )}
        </div>

        {/*
          ── Collapsible body ──
          Mobile: hidden when collapsed, visible when expanded.
          Desktop (lg): always visible — `lg:block` overrides `hidden`.
        */}
        <div className={cn(collapsed && 'hidden lg:block')}>
          {/* Cards drop zone */}
          <div
            ref={setNodeRef}
            className={cn(
              'space-y-2 min-h-[8px] rounded-xl transition-colors',
              isOver && 'bg-brand-50 ring-2 ring-inset ring-brand-200'
            )}
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
                  onDeleteCard={onDeleteCard}
                  onCommentCountChange={onCommentCountChange}
                  onLinkCountChange={onLinkCountChange}
                />
              ))}
            </SortableContext>
          </div>

          {/* Add card — full-width, comfortable tap target */}
          <button
            onClick={() => setShowCreateCard(true)}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 hover:bg-white transition-colors"
          >
            <Plus size={15} />
            {t('addCard')}
          </button>
        </div>
      </div>

      <CreateCardDialog
        open={showCreateCard}
        onClose={() => setShowCreateCard(false)}
        columnId={column.id}
        boardId={boardId}
        currentUserId={userId}
        members={members}
        onCreated={onCardCreated}
      />
    </div>
  )
}
