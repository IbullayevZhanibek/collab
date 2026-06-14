import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { TaskFilters } from '@/components/tasks/TaskFilters'
import { TaskViewToggle } from '@/components/tasks/TaskViewToggle'
import { Suspense } from 'react'
import type { Card, Board } from '@/lib/types'

export const metadata: Metadata = { title: 'Мои задачи' }

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
}

function pluralizeTasks(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'задача'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'задачи'
  return 'задач'
}

type EnrichedCard = Card & {
  column: { id: string; title: string; board_id: string }
  board: Board
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ priority?: string; view?: string }>
}) {
  const { priority, view = 'list' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get all boards accessible to user
  const { data: boards } = await supabase
    .from('boards')
    .select('id, title, owner_id, created_at')

  const boardIds = boards?.map((b) => b.id) ?? []

  // Get all columns for those boards
  const { data: columns } = await supabase
    .from('columns')
    .select('id, title, board_id, position')
    .in('board_id', boardIds.length > 0 ? boardIds : [''])

  const columnIds = columns?.map((c) => c.id) ?? []

  // Get cards
  let query = supabase
    .from('cards')
    .select('*')
    .in('column_id', columnIds.length > 0 ? columnIds : [''])
    .order('created_at', { ascending: false })

  if (priority) {
    query = query.eq('priority', priority)
  }

  const { data: cards } = await query

  // Enrich cards with column + board info
  const columnMap = new Map(columns?.map((c) => [c.id, c]) ?? [])
  const boardMap = new Map(boards?.map((b) => [b.id, b]) ?? [])

  const enrichedCards: EnrichedCard[] = (cards ?? [])
    .map((card) => {
      const column = columnMap.get(card.column_id)
      const board = column ? boardMap.get(column.board_id) : undefined
      if (!column || !board) return null
      return { ...card, column, board }
    })
    .filter((c): c is EnrichedCard => c !== null)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  const isOverdue = (dateStr: string | null) =>
    dateStr && new Date(dateStr) < new Date()

  // Group by column title for kanban view
  const columnGroups = new Map<string, EnrichedCard[]>()
  for (const card of enrichedCards) {
    const key = card.column.title
    if (!columnGroups.has(key)) columnGroups.set(key, [])
    columnGroups.get(key)!.push(card)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Мои задачи</h1>
            <p className="text-gray-500 text-sm mt-1">
              {enrichedCards.length === 0
                ? 'Все задачи со всех досок — в одном месте'
                : `${enrichedCards.length} ${pluralizeTasks(enrichedCards.length)} со всех ваших досок`}
            </p>
          </div>
          <Suspense>
            <TaskViewToggle />
          </Suspense>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <Suspense>
            <TaskFilters />
          </Suspense>
        </div>

        {enrichedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">{priority ? '🔍' : '📋'}</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {priority ? 'Под фильтр ничего не подошло' : 'Здесь будут ваши задачи'}
            </h2>
            <p className="text-gray-500 text-sm max-w-xs">
              {priority
                ? 'Попробуйте сбросить фильтр или выбрать другой приоритет.'
                : 'Откройте любую доску и добавьте первую карточку — она тут же появится в этом списке.'}
            </p>
          </div>
        ) : view === 'kanban' ? (
          /* Kanban view */
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
            {Array.from(columnGroups.entries()).map(([columnTitle, columnCards]) => (
              <div key={columnTitle} className="shrink-0 w-[280px] sm:w-72 snap-start">
                <div className="bg-gray-100/80 border border-gray-200/70 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <h3 className="font-semibold text-gray-800 text-sm">{columnTitle}</h3>
                    <span className="bg-gray-200 text-gray-600 rounded-full text-xs px-2 py-0.5 font-semibold tabular-nums">
                      {columnCards.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {columnCards.map((card) => (
                      <Link
                        key={card.id}
                        href={`/board/${card.board.id}`}
                        className="block bg-white rounded-xl border border-gray-200 shadow-soft p-3 cursor-pointer hover:border-brand-300 hover:shadow-card transition-all"
                      >
                        <p className="text-sm font-medium text-gray-900 mb-1">{card.title}</p>
                        <p className="text-xs text-gray-500 mb-2 inline-flex items-center gap-1">
                          {card.board.title}
                          <ExternalLink size={10} className="text-gray-400" />
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {card.priority && (
                            <Badge
                              variant={card.priority as 'low' | 'medium' | 'high' | 'critical'}
                            >
                              {PRIORITY_LABELS[card.priority]}
                            </Badge>
                          )}
                          {card.due_date && (
                            <span
                              className={`text-xs inline-flex items-center gap-1 ${
                                isOverdue(card.due_date) ? 'text-red-600' : 'text-gray-500'
                              }`}
                            >
                              <CalendarDays size={11} />
                              {formatDate(card.due_date)}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-soft divide-y divide-gray-100 overflow-hidden">
            {enrichedCards.map((card) => (
              <Link
                key={card.id}
                href={`/board/${card.board.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{card.title}</p>
                  {card.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {card.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
                  {/* Status badge (column name) */}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                    {card.column.title}
                  </span>

                  {card.priority && (
                    <Badge variant={card.priority as 'low' | 'medium' | 'high' | 'critical'}>
                      {PRIORITY_LABELS[card.priority]}
                    </Badge>
                  )}

                  {card.due_date && (
                    <span
                      className={`text-xs inline-flex items-center gap-1 ${
                        isOverdue(card.due_date) ? 'text-red-600 font-medium' : 'text-gray-500'
                      }`}
                    >
                      <CalendarDays size={12} />
                      {formatDate(card.due_date)}
                    </span>
                  )}

                  <span className="text-xs text-gray-500 font-medium whitespace-nowrap inline-flex items-center gap-1">
                    {card.board.title}
                    <ExternalLink size={11} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
