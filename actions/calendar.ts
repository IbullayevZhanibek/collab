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

  // Один запрос с вложенным join cards → columns → boards (RLS отфильтрует чужие)
  // вместо трёх последовательных round-trip'ов boards → columns → cards.
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, title, due_date, priority, columns!inner(title, boards!inner(id, title))')
    .not('due_date', 'is', null)
    .gte('due_date', start)
    .lte('due_date', end)

  if (error) return { error: error.message }

  const tasks: CalendarTask[] = (cards ?? [])
    .map((card) => {
      const column = card.columns as unknown as { title: string; boards: { id: string; title: string } } | null
      const board = column?.boards
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
