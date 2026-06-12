'use client'

import { useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Paperclip, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { deleteCard } from '@/actions/cards'
import { CardDetailDialog } from './CardDetailDialog'
import type { Card } from '@/lib/types'

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
}

interface BoardCardProps {
  card: Card
  boardId: string
  userId: string
}

export function BoardCard({ card, boardId, userId }: BoardCardProps) {
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
    if (!confirm('Удалить задачу?')) return
    startTransition(async () => {
      await deleteCard(card.id, boardId)
    })
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

  const isOverdue = card.due_date && new Date(card.due_date) < new Date()

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="group bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all p-3 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug">{card.title}</p>

            {card.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.description}</p>
            )}

            <div className="flex items-center flex-wrap gap-1.5 mt-2">
              {card.priority && (
                <Badge variant={card.priority as 'low' | 'medium' | 'high' | 'critical'}>
                  {PRIORITY_LABELS[card.priority]}
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

          <div className="flex flex-col gap-1 flex-shrink-0">
            {/* Attachments button — stopPropagation prevents drag start */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 rounded text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
              title="Вложения"
            >
              <Paperclip size={13} />
            </button>

            <button
              onClick={handleDelete}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={isPending}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Удалить"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      <CardDetailDialog
        open={showDetail}
        onClose={() => setShowDetail(false)}
        card={card}
        currentUserId={userId}
      />
    </>
  )
}
