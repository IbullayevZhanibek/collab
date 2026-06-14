'use client'

import { useState, useTransition } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createBoard } from '@/actions/boards'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CreateBoardDialogProps {
  open: boolean
  onClose: () => void
}

export function CreateBoardDialog({ open, onClose }: CreateBoardDialogProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const posthog = usePostHog()

  function handleCreate() {
    if (!title.trim()) {
      setError('Введите название доски')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createBoard(title.trim())
      if (result?.error) {
        setError(result.error)
      } else {
        posthog.capture('board_created', { board_id: result?.data?.id })
        setTitle('')
        onClose()
      }
    })
  }

  function handleClose() {
    setTitle('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Создать доску">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Название доски
        </label>
        <Input
          placeholder="Например: Проект 2025"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleClose} disabled={isPending}>
          Отмена
        </Button>
        <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
          {isPending ? 'Создание...' : 'Создать'}
        </Button>
      </div>
    </Dialog>
  )
}
