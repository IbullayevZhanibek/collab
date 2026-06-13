import { CalendarDays, AlertTriangle, CheckCircle2, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardStats } from '@/lib/types'

interface StatCard {
  label: string
  value: number
  Icon: typeof CalendarDays
  iconWrap: string
  valueClass?: string
}

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const cards: StatCard[] = [
    {
      label: 'Задач на сегодня',
      value: stats.today,
      Icon: CalendarDays,
      iconWrap: 'bg-brand-100 text-brand-600',
    },
    {
      label: 'Просрочено',
      value: stats.overdue,
      Icon: AlertTriangle,
      iconWrap: 'bg-red-100 text-red-600',
      valueClass: stats.overdue > 0 ? 'text-red-600' : undefined,
    },
    {
      label: 'Выполнено',
      value: stats.done,
      Icon: CheckCircle2,
      iconWrap: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Всего активных',
      value: stats.active,
      Icon: ListTodo,
      iconWrap: 'bg-gray-100 text-gray-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {cards.map(({ label, value, Icon, iconWrap, valueClass }) => (
        <div
          key={label}
          className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4 sm:p-5"
        >
          <div className={cn('inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3', iconWrap)}>
            <Icon size={18} />
          </div>
          <p className={cn('text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums leading-none', valueClass)}>
            {value}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5">{label}</p>
        </div>
      ))}
    </div>
  )
}
