'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CalendarTask } from '@/lib/types'

/**
 * Все задачи пользователя с дедлайном (due_date) в указанном месяце.
 * @param year полный год, напр. 2026
 * @param month номер месяца 1–12
 */
export async function getCalendarTasks(
  year: number,
  month: number,
): Promise<{ data?: CalendarTask[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const pad = (n: number) => String(n).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`

  // Доски, доступные пользователю (RLS отфильтрует чужие).
  const { data: boards } = await supabase
    .from('boards')
    .select('id, title')

  const boardIds = boards?.map((b) => b.id) ?? []

  const { data: columns } = await supabase
    .from('columns')
    .select('id, title, board_id')
    .in('board_id', boardIds.length > 0 ? boardIds : [''])

  const columnIds = columns?.map((c) => c.id) ?? []

  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, title, due_date, priority, column_id')
    .in('column_id', columnIds.length > 0 ? columnIds : [''])
    .not('due_date', 'is', null)
    .gte('due_date', start)
    .lte('due_date', end)

  if (error) return { error: error.message }

  const columnMap = new Map(columns?.map((c) => [c.id, c]) ?? [])
  const boardMap = new Map(boards?.map((b) => [b.id, b]) ?? [])

  const tasks: CalendarTask[] = (cards ?? [])
    .map((card) => {
      const column = columnMap.get(card.column_id)
      const board = column ? boardMap.get(column.board_id) : undefined
      if (!column || !board) return null
      return {
        id: card.id,
        title: card.title,
        due_date: card.due_date as string,
        priority: card.priority,
        board_id: board.id,
        board_title: board.title,
        column_title: column.title,
      }
    })
    .filter((t): t is CalendarTask => t !== null)

  return { data: tasks }
}
