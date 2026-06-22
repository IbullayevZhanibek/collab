'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { usePostHog } from 'posthog-js/react'
import { createCard } from '@/actions/cards'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import type { Card, MemberWithProfile } from '@/lib/types'

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  columnId: string
  boardId: string
  currentUserId?: string
  members?: MemberWithProfile[]
  onCreated?: (card: Card) => void
}

export function CreateCardDialog({
  open,
  onClose,
  columnId,
  boardId,
  currentUserId,
  members = [],
  onCreated,
}: CreateCardDialogProps) {
  const posthog = usePostHog()
  const t  = useTranslations('dialogs.createCard')
  const tc = useTranslations('common')
  const tp = useTranslations('priority')
  const tb = useTranslations('card')

  const [title, setTitle]         = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority]   = useState('')
  const [dueDate, setDueDate]     = useState('')
  // По умолчанию назначаем на себя.
  const [assigneeId, setAssigneeId] = useState(currentUserId ?? '')
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    if (!title.trim()) {
      setError(t('errorEmpty'))
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await createCard(columnId, boardId, {
        title,
        description: description || undefined,
        priority:    priority    || undefined,
        due_date:    dueDate     || undefined,
        assignee_id: assigneeId  || undefined,
      })

      if (result?.error) {
        setError(result.error)
        return
      }

      posthog.capture('card_created', { board_id: boardId, column_id: columnId })
      if (result.data) onCreated?.(result.data as import('@/lib/types').Card)
      resetForm()
      onClose()
    })
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setPriority('')
    setDueDate('')
    setAssigneeId(currentUserId ?? '')
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title={t('title')}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('titleLabel')}</label>
          <Input
            placeholder={t('titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('descriptionLabel')}</label>
          <Textarea
            placeholder={t('descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('priorityLabel')}</label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">{tp('none')}</option>
            <option value="low">{tp('low')}</option>
            <option value="medium">{tp('medium')}</option>
            <option value="high">{tp('high')}</option>
            <option value="critical">{tp('critical')}</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('dueDateLabel')}</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {members.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">{tb('assignee')}</label>
              {assigneeId !== currentUserId && currentUserId && (
                <button
                  type="button"
                  onClick={() => setAssigneeId(currentUserId)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  {tb('assignToMe')}
                </button>
              )}
            </div>
            <Select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">{tb('unassigned')}</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email}
                  {m.user_id === currentUserId ? ` (${tb('me')})` : ''}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleClose} disabled={isPending}>
          {tc('cancel')}
        </Button>
        <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </Dialog>
  )
}
