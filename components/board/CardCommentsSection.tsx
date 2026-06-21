'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Trash2, Loader2, Send, MessageSquare } from 'lucide-react'
import { getComments, addComment, deleteComment } from '@/actions/comments'
import { createClient } from '@/lib/supabase/client'
import type { CommentWithAuthor } from '@/lib/types'

interface CardCommentsSectionProps {
  cardId: string
  boardId: string
  currentUserId: string
  isTeacher: boolean
  onCountChange?: (count: number) => void
}

function relativeTime(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.round(diff / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (seconds < 60) return rtf.format(-seconds, 'second')
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  if (hours < 24) return rtf.format(-hours, 'hour')
  return rtf.format(-days, 'day')
}

export function CardCommentsSection({
  cardId,
  boardId,
  currentUserId,
  isTeacher,
  onCountChange,
}: CardCommentsSectionProps) {
  const t = useTranslations('comments')
  const locale = useLocale()
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [isFeedback, setIsFeedback] = useState(false)
  const [isSending, startSend] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Загружаем комментарии при монтировании и при смене карточки.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setComments([])
    getComments(cardId).then(({ data }) => {
      if (cancelled) return
      const list = data ?? []
      setComments(list)
      onCountChange?.(list.length)
      setLoading(false)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  // Realtime: пересчитываем список при любом изменении комментариев карточки.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`comments-${cardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `card_id=eq.${cardId}` },
        () => {
          // Перезапрашиваем полный список чтобы получить данные авторов.
          getComments(cardId).then(({ data }) => {
            const list = data ?? []
            setComments(list)
            onCountChange?.(list.length)
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || isSending) return

    // Оптимистичное добавление
    const optimistic: CommentWithAuthor = {
      id: `opt-${Date.now()}`,
      card_id: cardId,
      user_id: currentUserId,
      body: trimmed,
      is_feedback: isTeacher && isFeedback,
      created_at: new Date().toISOString(),
      full_name: null,
      avatar_url: null,
      global_role: isTeacher ? 'teacher' : 'student',
      team_role: null,
    }
    setComments((prev) => [...prev, optimistic])
    onCountChange?.(comments.length + 1)
    setBody('')

    startSend(async () => {
      const res = await addComment(cardId, boardId, trimmed, isFeedback)
      if (res.error) {
        // Откат
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
        onCountChange?.(comments.length)
        setBody(trimmed)
      }
      // При успехе realtime-событие заменит оптимистичный элемент настоящим.
    })
  }

  async function handleDelete(commentId: string) {
    if (!confirm(t('confirmDelete'))) return
    setDeletingId(commentId)
    const res = await deleteComment(commentId, boardId)
    setDeletingId(null)
    if (!res.error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      onCountChange?.(comments.filter((c) => c.id !== commentId).length)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const isOptimistic = (id: string) => id.startsWith('opt-')

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <MessageSquare size={15} className="text-gray-400" />
        {t('title')}
        {comments.length > 0 && (
          <span className="ml-auto text-xs font-normal text-gray-400">{comments.length}</span>
        )}
      </h3>

      {/* Список комментариев */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-gray-300" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">{t('empty')}</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl p-3 text-sm transition-opacity ${
                isOptimistic(c.id) ? 'opacity-60' : 'opacity-100'
              } ${
                c.is_feedback
                  ? 'bg-brand-50 border border-brand-200'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              {c.is_feedback && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-100 rounded-full px-2 py-0.5">
                    {t('feedback')}
                  </span>
                </div>
              )}

              <div className="flex items-start gap-2">
                {/* Аватар */}
                <div className="shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden text-xs font-semibold text-gray-600">
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (c.full_name?.[0] ?? '?').toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-gray-900 text-xs">
                      {c.full_name ?? '—'}
                    </span>
                    {c.global_role === 'teacher' && (
                      <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-1.5 py-px leading-none">
                        {t('teacher')}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                      {relativeTime(c.created_at, locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap break-words leading-snug">
                    {c.body}
                  </p>
                </div>

                {/* Удаление — только автор */}
                {c.user_id === currentUserId && !isOptimistic(c.id) && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title={t('delete')}
                  >
                    {deletingId === c.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Форма ввода */}
      <div className="space-y-2">
        {isTeacher && (
          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={isFeedback}
              onChange={(e) => setIsFeedback(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
            />
            <span className="text-xs text-gray-600">{t('markAsFeedback')}</span>
          </label>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('add')}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || isSending}
            className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={t('send')}
          >
            {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
