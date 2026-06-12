'use client'

import { useState, useEffect, useTransition } from 'react'
import { Download, Trash2, Paperclip, Loader2 } from 'lucide-react'
import { getAttachments, deleteAttachment, getDownloadUrl } from '@/actions/attachments'
import type { Attachment } from '@/lib/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1_048_576).toFixed(1)} МБ`
}

function fileIcon(type: string | null): string {
  if (!type) return '📎'
  if (type.startsWith('image/')) return '🖼️'
  if (type === 'application/pdf') return '📄'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('sheet') || type.includes('excel')) return '📊'
  if (type.includes('zip') || type.includes('archive')) return '🗜️'
  return '📎'
}

interface CardAttachmentsProps {
  cardId: string
  currentUserId: string
}

export function CardAttachments({ cardId, currentUserId }: CardAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    getAttachments(cardId).then(({ data }) => {
      setAttachments(data ?? [])
      setLoading(false)
    })
  }, [cardId])

  function handleDownload(attachment: Attachment) {
    setDownloadingId(attachment.id)
    startTransition(async () => {
      const { url, error } = await getDownloadUrl(attachment.storage_path)
      setDownloadingId(null)
      if (url) {
        const a = document.createElement('a')
        a.href = url
        a.download = attachment.file_name
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.click()
      } else if (error) {
        alert(`Ошибка скачивания: ${error}`)
      }
    })
  }

  function handleDelete(attachment: Attachment) {
    if (!confirm(`Удалить файл «${attachment.file_name}»?`)) return
    setDeletingId(attachment.id)
    startTransition(async () => {
      const { error } = await deleteAttachment(attachment.id, attachment.storage_path)
      if (error) {
        alert(`Ошибка удаления: ${error}`)
      } else {
        setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
      }
      setDeletingId(null)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        Загрузка вложений…
      </div>
    )
  }

  if (attachments.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
        <Paperclip size={14} />
        Нет вложений
      </div>
    )
  }

  return (
    <ul className="space-y-1.5">
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100"
        >
          <span className="text-base leading-none flex-shrink-0" aria-hidden>
            {fileIcon(attachment.file_type)}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{attachment.file_name}</p>
            {attachment.file_size !== null && (
              <p className="text-xs text-gray-400">{formatBytes(attachment.file_size)}</p>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => handleDownload(attachment)}
              disabled={isPending}
              title="Скачать"
              className="p-1.5 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
            >
              {downloadingId === attachment.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>

            {currentUserId === attachment.user_id && (
              <button
                onClick={() => handleDelete(attachment)}
                disabled={isPending}
                title="Удалить"
                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deletingId === attachment.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
