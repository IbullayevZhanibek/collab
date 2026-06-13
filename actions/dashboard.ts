'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DashboardStats, NotificationItem } from '@/lib/types'

const DONE_TITLES = ['готово', 'done']
const SOON_DAYS = 3 // окно «ближайшие дни» для уведомлений

const pad = (n: number) => String(n).padStart(2, '0')

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysUntil(dueKey: string, today: string): number {
  const due = new Date(dueKey + 'T00:00:00').getTime()
  const base = new Date(today + 'T00:00:00').getTime()
  return Math.round((due - base) / 86_400_000)
}

function isDone(columnTitle: string): boolean {
  return DONE_TITLES.includes(columnTitle.trim().toLowerCase())
}

type LoadedCard = {
  id: string
  title: string
  due_date: string | null
  priority: NotificationItem['priority']
  board_id: string
  board_title: string
  done: boolean
}

// Все карточки со всех досок пользователя (RLS ограничивает доступ),
// обогащённые контекстом доски/колонки и флагом «выполнено».
async function loadCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<LoadedCard[]> {
  const { data: boards } = await supabase.from('boards').select('id, title')
  const boardIds = boards?.map((b) => b.id) ?? []

  const { data: columns } = await supabase
    .from('columns')
    .select('id, title, board_id')
    .in('board_id', boardIds.length > 0 ? boardIds : [''])
  const columnIds = columns?.map((c) => c.id) ?? []

  const { data: cards } = await supabase
    .from('cards')
    .select('id, title, due_date, priority, column_id')
    .in('column_id', columnIds.length > 0 ? columnIds : [''])

  const columnMap = new Map(columns?.map((c) => [c.id, c]) ?? [])
  const boardMap = new Map(boards?.map((b) => [b.id, b]) ?? [])

  return (cards ?? [])
    .map((card): LoadedCard | null => {
      const column = columnMap.get(card.column_id)
      const board = column ? boardMap.get(column.board_id) : undefined
      if (!column || !board) return null
      return {
        id: card.id,
        title: card.title,
        due_date: card.due_date,
        priority: card.priority,
        board_id: board.id,
        board_title: board.title,
        done: isDone(column.title),
      }
    })
    .filter((c): c is LoadedCard => c !== null)
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cards = await loadCards(supabase)
  const today = todayKey()

  let todayCount = 0
  let overdue = 0
  let done = 0
  let active = 0

  for (const c of cards) {
    if (c.done) {
      done++
      continue
    }
    active++
    if (c.due_date === today) todayCount++
    else if (c.due_date && c.due_date < today) overdue++
  }

  return { today: todayCount, overdue, done, active }
}

export async function getImportantNotifications(): Promise<{ data: NotificationItem[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cards = await loadCards(supabase)
  const today = todayKey()

  const items: NotificationItem[] = cards
    .filter((c) => !c.done && c.due_date)
    .map((c) => ({
      id: c.id,
      title: c.title,
      due_date: c.due_date as string,
      priority: c.priority,
      board_id: c.board_id,
      board_title: c.board_title,
      days_until: daysUntil(c.due_date as string, today),
    }))
    // Просрочено + дедлайн сегодня + ближайшие SOON_DAYS дней.
    .filter((c) => c.days_until <= SOON_DAYS)
    // Сначала самые просроченные, затем по близости дедлайна.
    .sort((a, b) => a.days_until - b.days_until)

  return { data: items }
}
