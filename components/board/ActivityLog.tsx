'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { History, X, Loader2 } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getActivityLog } from '@/actions/activity'
import type { ActivityLogEntry } from '@/lib/types'

function actorName(entry: ActivityLogEntry): string {
  return entry.full_name || entry.email || 'Участник'
}

function detail(entry: ActivityLogEntry, key: string): string {
  const value = entry.details?.[key]
  return typeof value === 'string' ? value : ''
}

// Человекочитаемый текст действия. Род автора неизвестен,
// поэтому используем нейтральную форму с «(а)».
function describe(entry: ActivityLogEntry): string {
  const who = actorName(entry)
  switch (entry.action) {
    case 'card_created':
      return `${who} создал(а) задачу «${detail(entry, 'cardTitle')}» в колонке «${detail(entry, 'columnTitle')}»`
    case 'card_moved':
      return `${who} переместил(а) «${detail(entry, 'cardTitle')}» из «${detail(entry, 'fromColumn')}» в «${detail(entry, 'toColumn')}»`
    case 'card_deleted':
      return `${who} удалил(а) задачу «${detail(entry, 'cardTitle')}»`
    case 'column_created':
      return `${who} создал(а) колонку «${detail(entry, 'columnTitle')}»`
    case 'column_deleted':
      return `${who} удалил(а) колонку «${detail(entry, 'columnTitle')}»`
    case 'member_joined':
      return `${who} присоединился(ась) к доске`
    case 'member_left':
      return `${who} покинул(а) доску`
    default:
      return who
  }
}

export function ActivityLog({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
      >
        <History size={14} className="shrink-0" />
        <span className="hidden sm:inline">История</span>
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
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">История</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
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
                    <p className="text-sm font-medium text-gray-900">Пока нет активности</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-[14rem]">
                      Действия с карточками и колонками появятся здесь.
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
                              {formatRelativeTime(entry.created_at)}
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
