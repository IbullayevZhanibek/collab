'use client'

import { Paperclip } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { CardAttachments } from './CardAttachments'
import type { Card } from '@/lib/types'

interface CardDetailDialogProps {
  open: boolean
  onClose: () => void
  card: Card
  currentUserId: string
}

export function CardDetailDialog({
  open,
  onClose,
  card,
  currentUserId,
}: CardDetailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={card.title} className="max-w-lg">
      {card.description && (
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">{card.description}</p>
      )}

      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          <Paperclip size={12} />
          Вложения
        </h3>
        <CardAttachments cardId={card.id} currentUserId={currentUserId} />
      </div>
    </Dialog>
  )
}
