import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@/lib/types'

const MAX_VISIBLE = 6

type Tone = 'red' | 'orange' | 'amber'

const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100/70',
  orange: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100/70',
  amber: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70',
}

export async function Notifications({ items }: { items: NotificationItem[] }) {
  const t = await getTranslations('dashboard.notifications')
  const locale = await getLocale()

  const formatDueDate = (dueKey: string): string =>
    new Date(dueKey + 'T00:00:00').toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
    })

  function describe(item: NotificationItem): { text: string; tone: Tone } {
    if (item.days_until < 0) {
      return {
        text: t('overdue', { title: item.title, date: formatDueDate(item.due_date) }),
        tone: 'red',
      }
    }
    if (item.days_until === 0) {
      return { text: t('dueToday', { title: item.title }), tone: 'orange' }
    }
    if (item.days_until === 1) {
      return { text: t('dueTomorrow', { title: item.title }), tone: 'amber' }
    }
    return { text: t('dueInDays', { title: item.title, count: item.days_until }), tone: 'amber' }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-soft px-4 py-4 flex items-center gap-2.5">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 text-sm shrink-0">
          ✓
        </span>
        <p className="text-sm font-medium text-gray-700">
          {t('allClear')}
        </p>
      </div>
    )
  }

  const visible = items.slice(0, MAX_VISIBLE)
  const extra = items.length - visible.length

  return (
    <div className="space-y-2">
      {visible.map((item) => {
        const { text, tone } = describe(item)
        return (
          <Link
            key={item.id}
            href={`/board/${item.board_id}`}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors',
              TONE_CLASS[tone]
            )}
          >
            <span className="text-sm font-medium line-clamp-2 sm:line-clamp-none sm:truncate">{text}</span>
            <span className="text-xs opacity-70 shrink-0 hidden sm:inline">{item.board_title}</span>
          </Link>
        )
      })}
      {extra > 0 && (
        <p className="text-sm text-gray-500 px-1 pt-0.5">{t('more', { count: extra })}</p>
      )}
    </div>
  )
}
