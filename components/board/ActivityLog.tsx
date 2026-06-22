'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations, useLocale } from 'next-intl'
import { History, X, Loader2 } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getActivityLog } from '@/actions/activity'
import type { ActivityLogEntry } from '@/lib/types'

function detail(entry: ActivityLogEntry, key: string): string {
  const value = entry.details?.[key]
  return typeof value === 'string' ? value : ''
}

export function ActivityLog({ boardId }: { boardId: string }) {
  const t = useTranslations('activity')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const actorName = (entry: ActivityLogEntry): string =>
    entry.full_name || entry.email || t('actorFallback')

  // Человекочитаемый текст действия. Род автора неизвестен,
  // поэтому используем нейтральную форму с «(а)».
  function describe(entry: ActivityLogEntry): string {
    const who = actorName(entry)
    switch (entry.action) {
      case 'card_created':
        return t('actions.cardCreated', { who, cardTitle: detail(entry, 'cardTitle'), columnTitle: detail(entry, 'columnTitle') })
      case 'card_updated':
        return t('actions.cardUpdated', { who, cardTitle: detail(entry, 'cardTitle') })
      case 'card_moved':
        return t('actions.cardMoved', { who, cardTitle: detail(entry, 'cardTitle'), fromColumn: detail(entry, 'fromColumn'), toColumn: detail(entry, 'toColumn') })
      case 'card_deleted':
        return t('actions.cardDeleted', { who, cardTitle: detail(entry, 'cardTitle') })
      case 'column_created':
        return t('actions.columnCreated', { who, columnTitle: detail(entry, 'columnTitle') })
      case 'column_deleted':
        return t('actions.columnDeleted', { who, columnTitle: detail(entry, 'columnTitle') })
      case 'member_joined':
        return t('actions.memberJoined', { who })
      case 'member_left':
        return t('actions.memberLeft', { who })
      case 'board_completed':
        return t('actions.boardCompleted', { who })
      case 'board_reopened':
        return t('actions.boardReopened', { who })
      case 'stage_status_changed': {
        const stageTitle = detail(entry, 'stageTitle')
        const status = detail(entry, 'status')
        if (status === 'done') return t('actions.stageDone', { who, stageTitle })
        if (status === 'in_progress') return t('actions.stageStarted', { who, stageTitle })
        return t('actions.stagePending', { who, stageTitle })
      }
      default:
        return who
    }
  }

  // Грузим лог при первом открытии и обновляем при каждом следующем.
  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const result = await getActivityLog(boardId)
      setEntries(result.data ?? [])
      setLoaded(true)
    })
  }, [open, boardId])

  // Блокируем прокрутку фона и закрываем по Escape, пока панель открыта.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-2 sm:px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
      >
        <History size={16} className="shrink-0" />
        <span className="hidden sm:inline">{t('title')}</span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-overlay-in"
              onClick={() => setOpen(false)}
            />

            {/* Drawer справа */}
            <aside
              className={cn(
                'absolute inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-pop flex flex-col',
                'animate-drawer-in'
              )}
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-brand-600" />
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('title')}</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={tc('close')}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {isPending && !loaded ? (
                  <div className="flex items-center justify-center py-20 text-gray-400">
                    <Loader2 size={22} className="animate-spin" />
                  </div>
                ) : entries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-4xl mb-3">🕘</div>
                    <p className="text-sm font-medium text-gray-900">{t('emptyTitle')}</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-[14rem]">
                      {t('emptyBody')}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {entries.map((entry) => {
                      const who = actorName(entry)
                      return (
                        <li key={entry.id} className="flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs shrink-0 select-none">
                            {who.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 leading-snug">{describe(entry)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatRelativeTime(entry.created_at, locale, t('justNow'))}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </aside>
          </div>,
          document.body
        )}
    </>
  )
}
