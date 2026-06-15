'use client'

import { useState, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MoveCardMenu } from './MoveCardMenu'
import { CardDetailDialog } from './CardDetailDialog'
import { deleteCard } from '@/actions/cards'
import type { Card, Column } from '@/lib/types'

interface BoardCardProps {
  card: Card
  boardId: string
  userId: string
  /** Все колонки доски — для меню «Переместить в колонку» и диалога деталей. */
  columns?: Column[]
  /** Перемещение карточки в другую колонку (оптимистично + Server Action). */
  onMoveCard?: (cardId: string, targetColumnId: string) => void
  /** Сохранение правок из диалога деталей (оптимистично + Server Action). */
  onUpdateCard?: (cardId: string, updates: Partial<Card>) => Promise<{ error?: string } | void>
}

export function BoardCard({ card, boardId, columns, onMoveCard, onUpdateCard }: BoardCardProps) {
  const t = useTranslations('board')
  const tp = useTranslations('priority')
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [showDetail, setShowDetail] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', card },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('confirmDeleteCard'))) return
    startTransition(async () => {
      await deleteCard(card.id, boardId)
    })
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short' })

  const isOverdue = card.due_date && new Date(card.due_date) < new Date()

  return (
    <>
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group bg-white rounded-xl border border-gray-200 shadow-soft hover:border-brand-300 hover:shadow-card transition-all p-3 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        {/* Клик по телу карточки открывает детальный просмотр. Клики по кнопкам
            действий справа гасят всплытие и сюда не доходят. */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setShowDetail(true)}
        >
          <p className="text-sm font-medium text-gray-900 leading-snug">{card.title}</p>

          {card.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.description}</p>
          )}

          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            {card.priority && (
              <Badge variant={card.priority as 'low' | 'medium' | 'high' | 'critical'}>
                {tp(card.priority)}
              </Badge>
            )}
            {card.due_date && (
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  isOverdue ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                <CalendarDays size={11} />
                {formatDate(card.due_date)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onMoveCard && columns && columns.length > 1 && (
            <MoveCardMenu
              columns={columns}
              currentColumnId={card.column_id}
              onMove={(targetColumnId) => onMoveCard(card.id, targetColumnId)}
            />
          )}
          <button
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isPending}
            className="action-btn p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
            title={t('deleteCard')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>

    {columns && onUpdateCard && (
      <CardDetailDialog
        open={showDetail}
        onClose={() => setShowDetail(false)}
        card={card}
        boardId={boardId}
        columns={columns}
        onMove={(targetColumnId) => onMoveCard?.(card.id, targetColumnId)}
        onUpdate={(updates) => onUpdateCard(card.id, updates)}
      />
    )}
    </>
  )
}
