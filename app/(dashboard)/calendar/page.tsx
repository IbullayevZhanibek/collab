import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCalendarTasks } from '@/actions/calendar'
import { cn } from '@/lib/utils'
import type { CalendarTask } from '@/lib/types'

export const metadata: Metadata = { title: 'Календарь' }

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DONE_COLUMN = 'Готово'

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

// Цвет плашки по приоритету.
function priorityChip(priority: CalendarTask['priority']): string {
  switch (priority) {
    case 'low': return 'bg-emerald-100 text-emerald-700'
    case 'medium': return 'bg-amber-100 text-amber-700'
    case 'high': return 'bg-orange-100 text-orange-700'
    case 'critical': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function isOverdue(task: CalendarTask, todayKey: string): boolean {
  return task.due_date < todayKey && task.column_title !== DONE_COLUMN
}

// Одна плашка задачи. Просроченная — с красной обводкой.
function TaskChip({ task, todayKey }: { task: CalendarTask; todayKey: string }) {
  const overdue = isOverdue(task, todayKey)
  return (
    <Link
      href={`/board/${task.board_id}`}
      title={`${task.title} · ${task.board_title}`}
      className={cn(
        'block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-opacity hover:opacity-80',
        priorityChip(task.priority),
        overdue && 'ring-1 ring-red-500 text-red-700'
      )}
    >
      {task.title}
    </Link>
  )
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const now = new Date()

  let year = sp.year ? parseInt(sp.year, 10) : now.getFullYear()
  let month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1 // 1–12
  if (!Number.isInteger(year) || year < 1970 || year > 9999) year = now.getFullYear()
  if (!Number.isInteger(month) || month < 1 || month > 12) month = now.getMonth() + 1

  const { data: tasks } = await getCalendarTasks(year, month)
  const monthTasks = tasks ?? []

  // Группируем задачи по дню дедлайна.
  const byDay = new Map<string, CalendarTask[]>()
  for (const task of monthTasks) {
    const list = byDay.get(task.due_date) ?? []
    list.push(task)
    byDay.set(task.due_date, list)
  }

  const todayKey = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())

  // Геометрия сетки: понедельник — первый день недели.
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7 // 0=Пн
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  // Навигация по месяцам.
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  const navHref = (y: number, m: number) => `/calendar?year=${y}&month=${m}`

  // Дни месяца, у которых есть задачи (для мобильной «повестки»).
  const agendaDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .map((d) => ({ day: d, key: dateKey(year, month, d) }))
    .filter(({ key }) => byDay.has(key))

  const weekdayLong = (key: string) =>
    new Date(key + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'long' })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header + навигация */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {MONTHS[month - 1]} {year}
            </h1>
            <p className="text-gray-500 text-sm mt-1">Задачи по датам дедлайнов</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={navHref(prev.y, prev.m)}
              aria-label="Предыдущий месяц"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Сегодня
            </Link>
            <Link
              href={navHref(next.y, next.m)}
              aria-label="Следующий месяц"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        {monthTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-brand-50 rounded-3xl p-6 mb-5">
              <CalendarDays className="text-brand-400" size={44} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              В этом месяце нет задач с дедлайнами
            </h2>
            <p className="text-gray-500 text-sm max-w-xs">
              Поставьте задаче дату дедлайна — и она появится здесь.
            </p>
          </div>
        ) : (
          <>
            {/* ── Десктоп: месячная сетка ── */}
            <div className="hidden md:block">
              {/* Шапка дней недели */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((wd) => (
                  <div key={wd} className="text-xs font-semibold text-gray-400 text-center uppercase tracking-wide">
                    {wd}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-2xl overflow-hidden border border-gray-200">
                {Array.from({ length: totalCells }, (_, i) => {
                  const dayNum = i - firstWeekday + 1
                  const inMonth = dayNum >= 1 && dayNum <= daysInMonth
                  const key = inMonth ? dateKey(year, month, dayNum) : ''
                  const dayTasks = inMonth ? byDay.get(key) ?? [] : []
                  const isToday = key === todayKey
                  const visible = dayTasks.slice(0, 3)
                  const extra = dayTasks.length - visible.length

                  return (
                    <div
                      key={i}
                      className={cn(
                        'min-h-[104px] bg-white p-1.5 flex flex-col',
                        !inMonth && 'bg-gray-50/60'
                      )}
                    >
                      {inMonth && (
                        <>
                          <div className="flex justify-end mb-1">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold',
                                isToday ? 'bg-brand-600 text-white' : 'text-gray-500'
                              )}
                            >
                              {dayNum}
                            </span>
                          </div>
                          <div className="space-y-1 flex-1">
                            {visible.map((task) => (
                              <TaskChip key={task.id} task={task} todayKey={todayKey} />
                            ))}
                            {extra > 0 && (
                              <span className="block text-[11px] font-medium text-gray-400 px-1.5">
                                +{extra} ещё
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Мобильный: повестка по дням с задачами ── */}
            <div className="md:hidden space-y-3">
              {agendaDays.map(({ day, key }) => {
                const dayTasks = byDay.get(key) ?? []
                const isToday = key === todayKey
                return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold shrink-0',
                          isToday ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {day}
                      </span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {weekdayLong(key)}
                      </span>
                      {isToday && <span className="text-xs text-brand-600 font-medium">сегодня</span>}
                    </div>
                    <div className="space-y-1.5">
                      {dayTasks.map((task) => {
                        const overdue = isOverdue(task, todayKey)
                        return (
                          <Link
                            key={task.id}
                            href={`/board/${task.board_id}`}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
                          >
                            <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', priorityChip(task.priority))} />
                            <span className={cn('text-sm text-gray-800 truncate flex-1', overdue && 'text-red-600 font-medium')}>
                              {task.title}
                            </span>
                            <span className="text-xs text-gray-400 truncate max-w-[35%]">{task.board_title}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
