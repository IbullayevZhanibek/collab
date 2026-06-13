import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@/lib/types'

const MAX_VISIBLE = 6

function formatDueDate(dueKey: string): string {
  return new Date(dueKey + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

type Tone = 'red' | 'orange' | 'amber'

function describe(item: NotificationItem): { text: string; tone: Tone } {
  if (item.days_until < 0) {
    return {
      text: `⚠️ Задача «${item.title}» просрочена (срок был ${formatDueDate(item.due_date)})`,
      tone: 'red',
    }
  }
  if (item.days_until === 0) {
    return { text: `🔴 Задача «${item.title}» — срок сегодня`, tone: 'orange' }
  }
  const when =
    item.days_until === 1
      ? 'срок завтра'
      : `срок через ${item.days_until} ${pluralizeDays(item.days_until)}`
  return { text: `📅 Задача «${item.title}» — ${when}`, tone: 'amber' }
}

const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100/70',
  orange: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100/70',
  amber: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70',
}

export function Notifications({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-soft px-4 py-4 flex items-center gap-2.5">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 text-sm shrink-0">
          ✓
        </span>
        <p className="text-sm font-medium text-gray-700">
          Нет срочных задач — отличная работа!
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
        <p className="text-sm text-gray-500 px-1 pt-0.5">+{extra} ещё</p>
      )}
    </div>
  )
}
