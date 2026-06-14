'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { createCard } from '@/actions/cards'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  columnId: string
  boardId: string
}

export function CreateCardDialog({ open, onClose, columnId, boardId }: CreateCardDialogProps) {
  const router = useRouter()
  const posthog = usePostHog()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [, startRefresh] = useTransition()

  function handleCreate() {
    if (!title.trim()) {
      setError('Введите название задачи')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await createCard(columnId, boardId, {
        title,
        description: description || undefined,
        priority: priority || undefined,
        due_date: dueDate || undefined,
      })

      if (result?.error) {
        setError(result.error)
        return
      }

      posthog.capture('card_created', { board_id: boardId, column_id: columnId })
      resetForm()
      onClose()
      startRefresh(() => router.refresh())
    })
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setPriority('')
    setDueDate('')
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Создать задачу">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Название *</label>
          <Input
            placeholder="Что нужно сделать?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Описание</label>
          <Textarea
            placeholder="Подробное описание задачи…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Приоритет</label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="" className="text-gray-900">Не выбран</option>
            <option value="low" className="text-gray-900">Низкий</option>
            <option value="medium" className="text-gray-900">Средний</option>
            <option value="high" className="text-gray-900">Высокий</option>
            <option value="critical" className="text-gray-900">Критический</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Срок выполнения</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleClose} disabled={isPending}>
          Отмена
        </Button>
        <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
          {isPending ? 'Создание…' : 'Создать задачу'}
        </Button>
      </div>
    </Dialog>
  )
}
