'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Paperclip,
  Trash2,
  Loader2,
  Plus,
  ExternalLink,
  Code,
  PenTool,
  FileText,
  Video,
  Link,
} from 'lucide-react'
import { getCardLinks, addCardLink, deleteCardLink } from '@/actions/card_links'
import { createClient } from '@/lib/supabase/client'
import type { CardLinkWithAuthor, LinkType } from '@/lib/types'

interface CardLinksSectionProps {
  cardId: string
  boardId: string
  currentUserId: string
  onCountChange?: (count: number) => void
}

function LinkIcon({ type, size = 14 }: { type: LinkType; size?: number }) {
  const cls = 'shrink-0'
  switch (type) {
    case 'github': return <Code   size={size} className={cls} />
    case 'figma':  return <PenTool size={size} className={cls} />
    case 'gdrive': return <FileText size={size} className={cls} />
    case 'video':  return <Video  size={size} className={cls} />
    default:       return <Link   size={size} className={cls} />
  }
}

function displayUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    const path = pathname.length > 1 ? pathname.slice(0, 28) + (pathname.length > 28 ? '…' : '') : ''
    return hostname.replace(/^www\./, '') + path
  } catch {
    return url.slice(0, 40)
  }
}

function clientValidateUrl(url: string): string | null {
  const s = url.trim()
  if (!s) return null // пустое поле — просто не показываем ошибку
  try {
    const p = new URL(s)
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return 'invalidUrl'
    return null
  } catch {
    return 'invalidUrl'
  }
}

export function CardLinksSection({
  cardId,
  boardId,
  currentUserId,
  onCountChange,
}: CardLinksSectionProps) {
  const t = useTranslations('links')

  const [links, setLinks] = useState<CardLinkWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isAdding, startAdd] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Загрузка при маунте / смене карточки.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLinks([])
    getCardLinks(cardId).then(({ data }) => {
      if (cancelled) return
      const list = data ?? []
      setLinks(list)
      onCountChange?.(list.length)
      setLoading(false)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  // Realtime: пересинхронизация при изменениях.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`links-${cardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'card_links', filter: `card_id=eq.${cardId}` },
        () => {
          getCardLinks(cardId).then(({ data }) => {
            const list = data ?? []
            setLinks(list)
            onCountChange?.(list.length)
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  function handleUrlChange(value: string) {
    setUrl(value)
    if (urlError) setUrlError(clientValidateUrl(value))
  }

  function handleAdd() {
    const err = clientValidateUrl(url)
    if (err) { setUrlError(t(err as 'invalidUrl')); return }
    if (!url.trim()) { setUrlError(t('invalidUrl')); return }

    const trimmedUrl = url.trim()
    const trimmedTitle = linkTitle.trim() || null

    // Определяем тип локально для оптимистичного обновления.
    let optimisticType: LinkType = 'other'
    try {
      const { hostname } = new URL(trimmedUrl)
      if (hostname.includes('github.com') || hostname.includes('gitlab.com')) optimisticType = 'github'
      else if (hostname.includes('figma.com')) optimisticType = 'figma'
      else if (hostname.includes('drive.google.com') || hostname.includes('docs.google.com') || hostname.includes('sheets.google.com') || hostname.includes('slides.google.com')) optimisticType = 'gdrive'
      else if (hostname.includes('youtube.com') || hostname.includes('youtu.be') || hostname.includes('vimeo.com') || hostname.includes('loom.com')) optimisticType = 'video'
    } catch { /* нет */ }

    const optimistic: CardLinkWithAuthor = {
      id: `opt-${Date.now()}`,
      card_id: cardId,
      board_id: boardId,
      user_id: currentUserId,
      url: trimmedUrl,
      title: trimmedTitle,
      link_type: optimisticType,
      created_at: new Date().toISOString(),
      full_name: null,
    }

    setLinks((prev) => [...prev, optimistic])
    onCountChange?.(links.length + 1)
    setUrl('')
    setLinkTitle('')
    setShowForm(false)
    setUrlError(null)

    startAdd(async () => {
      const res = await addCardLink(cardId, boardId, trimmedUrl, trimmedTitle ?? undefined)
      if (res.error) {
        setLinks((prev) => prev.filter((l) => l.id !== optimistic.id))
        onCountChange?.(links.length)
        setUrl(trimmedUrl)
        setLinkTitle(trimmedTitle ?? '')
        setShowForm(true)
        setUrlError(res.error)
      }
      // При успехе realtime заменит оптимистичный элемент настоящим.
    })
  }

  async function handleDelete(linkId: string) {
    if (!confirm(t('confirmDelete'))) return
    setDeletingId(linkId)
    const res = await deleteCardLink(linkId, boardId)
    setDeletingId(null)
    if (!res.error) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
      onCountChange?.(links.filter((l) => l.id !== linkId).length)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleAdd()
    }
  }

  const isOptimistic = (id: string) => id.startsWith('opt-')

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Paperclip size={15} className="text-gray-400" />
        {t('title')}
        {links.length > 0 && (
          <span className="ml-auto text-xs font-normal text-gray-400">{links.length}</span>
        )}
      </h3>

      {/* Список ссылок */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-gray-300" />
        </div>
      ) : links.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400 text-center py-3">{t('empty')}</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {links.map((link) => (
            <li
              key={link.id}
              className={`flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm transition-opacity ${
                isOptimistic(link.id) ? 'opacity-60' : ''
              }`}
            >
              {/* Иконка типа */}
              <span className="shrink-0 text-gray-400">
                <LinkIcon type={link.link_type as LinkType} size={14} />
              </span>

              {/* Ссылка */}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 group"
                title={link.url}
              >
                <span className="block text-gray-800 font-medium text-xs truncate group-hover:text-brand-600 transition-colors">
                  {link.title || displayUrl(link.url)}
                </span>
                {link.title && (
                  <span className="block text-[10px] text-gray-400 truncate">
                    {displayUrl(link.url)}
                  </span>
                )}
              </a>

              {/* Иконка открытия в новой вкладке */}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1 rounded text-gray-300 hover:text-brand-500 transition-colors"
                tabIndex={-1}
                aria-hidden
              >
                <ExternalLink size={12} />
              </a>

              {/* Удалить — только автор */}
              {link.user_id === currentUserId && !isOptimistic(link.id) && (
                <button
                  onClick={() => handleDelete(link.id)}
                  disabled={deletingId === link.id}
                  className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title={t('delete')}
                >
                  {deletingId === link.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Форма добавления */}
      {showForm ? (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <div>
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={t('urlPlaceholder')}
              autoFocus
              className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                urlError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                  : 'border-gray-200 focus:border-brand-400 focus:ring-brand-100'
              }`}
            />
            {urlError && (
              <p className="mt-1 text-xs text-red-500">{urlError}</p>
            )}
          </div>

          <input
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={isAdding || !url.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t('add')}
            </button>
            <button
              onClick={() => { setShowForm(false); setUrl(''); setLinkTitle(''); setUrlError(null) }}
              className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-200 py-2 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <Plus size={14} />
          {t('add')}
        </button>
      )}
    </div>
  )
}
