'use client'

import { useState, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Trash2, Loader2, CalendarDays } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MoveCardMenu } from './MoveCardMenu'
import { deleteCard } from '@/actions/cards'
import type { Card, Column } from '@/lib/types'

interface CardDetailDialogProps {
  open: boolean
  onClose: () => void
  card: Card
  boardId: string
  columns: Column[]
  /** Перемещение в другую колонку (оптимистично + Server Action на уровне доски). */
  onMove: (targetColumnId: string) => void
  /** Сохранение изменений: оптимистично обновляет доску и пишет на сервер. */
  onUpdate: (updates: Partial<Card>) => Promise<{ error?: string } | void>
}

type Priority = 'low' | 'medium' | 'high' | 'critical'

export function CardDetailDialog({
  open,
  onClose,
  card,
  boardId,
  columns,
  onMove,
  onUpdate,
}: CardDetailDialogProps) {
  const t = useTranslations('board')
  const tf = useTranslations('dialogs.createCard')
  const tp = useTranslations('priority')
  const tc = useTranslations('common')
  const locale = useLocale()

  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [priority, setPriority] = useState(card.priority ?? '')
  const [dueDate, setDueDate] = useState(card.due_date ? card.due_date.slice(0, 10) : '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  // Перечитываем поля из карточки при (повторном) открытии диалога или смене
  // карточки — синхронизация во время рендера (рекомендованный React паттерн),
  // чтобы realtime-обновления не затирали правки во время редактирования.
  const [synced, setSynced] = useState<string | null>(null)
  if (open && synced !== card.id) {
    setSynced(card.id)
    setTitle(card.title)
    setDescription(card.description ?? '')
    setPriority(card.priority ?? '')
    setDueDate(card.due_date ? card.due_date.slice(0, 10) : '')
    setError(null)
  }
  if (!open && synced !== null) setSynced(null)

  const currentColumn = columns.find((c) => c.id === card.column_id)

  const dirty =
    title.trim() !== card.title ||
    (description.trim() || '') !== (card.description ?? '') ||
    (priority || '') !== (card.priority ?? '') ||
    (dueDate || '') !== (card.due_date ? card.due_date.slice(0, 10) : '')

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError(tf('errorEmpty'))
      return
    }
    setError(null)
    const updates: Partial<Card> = {
      title: trimmed,
      description: description.trim() || null,
      priority: (priority || null) as Priority | null,
      due_date: dueDate || null,
    }
    startSave(async () => {
      const res = await onUpdate(updates)
      if (res?.error) {
        setError(res.error)
        return
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!confirm(t('confirmDeleteCard'))) return
    setError(null)
    startDelete(async () => {
      const res = await deleteCard(card.id, boardId)
      if (res?.error) {
        setError(res.error)
        return
      }
      // Удалённая карточка уйдёт из доски через realtime-подписку KanbanBoard.
      onClose()
    })
  }

  // Перемещение из диалога закрываем сразу: после смены колонки карточка
  // перемонтируется в новую колонку, и диалог всё равно потерял бы состояние.
  function handleMove(targetColumnId: string) {
    onMove(targetColumnId)
    onClose()
  }

  const createdAt = new Date(card.created_at).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const busy = isSaving || isDeleting

  return (
    <Dialog open={open} onClose={onClose} title={t('cardDetails')} className="sm:max-w-lg" disableAutoFocus>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Название */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{tf('titleLabel')}</label>
          <Input
            value={title}
            placeholder={tf('titlePlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Описание — полностью, с переносами и прокруткой при большом объёме */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{tf('descriptionLabel')}</label>
          <Textarea
            value={description}
            placeholder={tf('descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="max-h-60 overflow-y-auto"
          />
        </div>

        {/* Приоритет: бейдж текущего значения + редактируемый select */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="block text-sm font-medium text-gray-700">{tf('priorityLabel')}</label>
            {priority && <Badge variant={priority as Priority}>{tp(priority as Priority)}</Badge>}
          </div>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="" className="text-gray-900">{tp('none')}</option>
            <option value="low" className="text-gray-900">{tp('low')}</option>
            <option value="medium" className="text-gray-900">{tp('medium')}</option>
            <option value="high" className="text-gray-900">{tp('high')}</option>
            <option value="critical" className="text-gray-900">{tp('critical')}</option>
          </Select>
        </div>

        {/* Дедлайн */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{tf('dueDateLabel')}</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        {/* Колонка + перемещение */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{t('columnLabel')}</p>
            <p className="text-sm font-medium text-gray-800 truncate">{currentColumn?.title ?? '—'}</p>
          </div>
          {columns.length > 1 && (
            <div className="relative shrink-0">
              <MoveCardMenu
                columns={columns}
                currentColumnId={card.column_id}
                onMove={handleMove}
              />
            </div>
          )}
        </div>

        {/* Метаданные: когда создана */}
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <CalendarDays size={12} />
          {t('createdAt', { date: createdAt })}
        </p>
      </div>

      {/* Действия */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          onClick={handleDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          {t('deleteCard')}
        </button>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={busy || !dirty || !title.trim()}>
            {isSaving ? tc('saving') : tc('save')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
