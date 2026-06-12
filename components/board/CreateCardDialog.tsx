'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, X, Loader2 } from 'lucide-react'
import { createCard } from '@/actions/cards'
import { createAttachment } from '@/actions/attachments'
import { createClient } from '@/lib/supabase/client'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1_048_576).toFixed(1)} МБ`
}

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  columnId: string
  boardId: string
}

export function CreateCardDialog({ open, onClose, columnId, boardId }: CreateCardDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [isPending, startTransition] = useTransition()
  const [, startRefresh] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...selected])
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleCreate() {
    if (!title.trim()) {
      setError('Введите название задачи')
      return
    }
    setError(null)

    startTransition(async () => {
      // 1. Create card
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

      // 2. Upload files if any
      if (files.length > 0 && result.data) {
        const cardId = result.data.id
        const supabase = createClient()
        const uploadErrors: string[] = []

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setUploadStatus(`Загрузка файла ${i + 1} из ${files.length}…`)

          // Sanitise filename for storage path
          const safeName = file.name.replace(/[^\w\s.\-]/g, '_')
          const path = `${cardId}/${Date.now()}_${safeName}`

          const { error: uploadError } = await supabase.storage
            .from('card-attachments')
            .upload(path, file, { upsert: false })

          if (uploadError) {
            uploadErrors.push(`${file.name}: ${uploadError.message}`)
            continue
          }

          await createAttachment({
            card_id: cardId,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || null,
            storage_path: path,
          })
        }

        setUploadStatus('')

        if (uploadErrors.length > 0) {
          setError(`Задача создана, но некоторые файлы не загрузились:\n${uploadErrors.join('\n')}`)
          startRefresh(() => router.refresh())
          return
        }
      }

      // 3. Done
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
    setFiles([])
    setError(null)
    setUploadStatus('')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  const isUploading = isPending && uploadStatus !== ''

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

        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Вложения</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <Paperclip size={14} className="mr-1.5" />
            Прикрепить файл
          </Button>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {files.map((file, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
                >
                  <span className="flex-1 text-sm text-gray-700 truncate">{file.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatBytes(file.size)}
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    disabled={isPending}
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="flex items-center gap-2 mb-4 text-sm text-indigo-600">
          <Loader2 size={14} className="animate-spin" />
          {uploadStatus}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleClose} disabled={isPending}>
          Отмена
        </Button>
        <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
          {isPending
            ? isUploading
              ? 'Загрузка…'
              : 'Создание…'
            : 'Создать задачу'}
        </Button>
      </div>
    </Dialog>
  )
}
