'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DashboardStats, NotificationItem, TeacherDashboardData, AttentionSignal, TeacherProjectSummary } from '@/lib/types'

const DONE_TITLES = ['РіРѕС‚РѕРІРѕ', 'done']

const DONE_KEYWORDS = [
  'РіРѕС‚РѕРІРѕ', 'done', 'Р·Р°РІРµСЂС€РµРЅРѕ', 'РІС‹РїРѕР»РЅРµРЅРѕ',
  'completed', 'finished', 'СЃРґРµР»Р°РЅРѕ', 'ready',
]

function isDoneColumnTitle(title: string): boolean {
  const lower = title.toLowerCase()
  return DONE_KEYWORDS.some((kw) => lower.includes(kw))
}
const SOON_DAYS = 3 // РѕРєРЅРѕ В«Р±Р»РёР¶Р°Р№С€РёРµ РґРЅРёВ» РґР»СЏ СѓРІРµРґРѕРјР»РµРЅРёР№

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

// РљР°СЂС‚РѕС‡РєРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ, РіРґРµ РѕРЅ РЅР°Р·РЅР°С‡РµРЅ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Рј (assignee_id = userId).
// РћРґРёРЅ Р·Р°РїСЂРѕСЃ СЃ РІР»РѕР¶РµРЅРЅС‹Рј join cards в†’ columns в†’ boards.
async function loadCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<LoadedCard[]> {
  const { data: cards } = await supabase
    .from('cards')
    .select('id, title, due_date, priority, columns!inner(title, boards!inner(id, title))')
    .eq('assignee_id', userId)

  return (cards ?? [])
    .map((card): LoadedCard | null => {
      // PostgREST РІРѕР·РІСЂР°С‰Р°РµС‚ РІР»РѕР¶РµРЅРЅС‹Рµ СЃРІСЏР·Рё РєР°Рє РѕР±СЉРµРєС‚С‹ (РґР»СЏ !inner вЂ” РЅРµ РјР°СЃСЃРёРІ).
      const column = card.columns as unknown as { title: string; boards: { id: string; title: string } } | null
      const board = column?.boards
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

function computeStats(cards: LoadedCard[], today: string): DashboardStats {
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

function computeNotifications(cards: LoadedCard[], today: string): NotificationItem[] {
  return cards
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
    // РџСЂРѕСЃСЂРѕС‡РµРЅРѕ + РґРµРґР»Р°Р№РЅ СЃРµРіРѕРґРЅСЏ + Р±Р»РёР¶Р°Р№С€РёРµ SOON_DAYS РґРЅРµР№.
    .filter((c) => c.days_until <= SOON_DAYS)
    // РЎРЅР°С‡Р°Р»Р° СЃР°РјС‹Рµ РїСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Рµ, Р·Р°С‚РµРј РїРѕ Р±Р»РёР·РѕСЃС‚Рё РґРµРґР»Р°Р№РЅР°.
    .sort((a, b) => a.days_until - b.days_until)
}

/**
 * РЎС‚Р°С‚РёСЃС‚РёРєР° Рё РІР°Р¶РЅС‹Рµ СѓРІРµРґРѕРјР»РµРЅРёСЏ Р·Р° РѕРґРёРЅ РїСЂРѕС…РѕРґ.
 * Р Р°РЅСЊС€Рµ getDashboardStats Рё getImportantNotifications РіСЂСѓР·РёР»Рё РѕРґРЅРё Рё С‚Рµ Р¶Рµ
 * РєР°СЂС‚РѕС‡РєРё РїРѕ РѕС‚РґРµР»СЊРЅРѕСЃС‚Рё (6 Р·Р°РїСЂРѕСЃРѕРІ СЃСѓРјРјР°СЂРЅРѕ) вЂ” С‚РµРїРµСЂСЊ СЌС‚Рѕ РѕРґРёРЅ Р·Р°РїСЂРѕСЃ.
 */
export async function getDashboardData(): Promise<{
  stats: DashboardStats
  notifications: NotificationItem[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cards = await loadCards(supabase, user.id)
  const today = todayKey()

  return {
    stats: computeStats(cards, today),
    notifications: computeNotifications(cards, today),
  }
}

/**
 * РђРіСЂРµРіРёСЂРѕРІР°РЅРЅС‹Р№ РґР°С€Р±РѕСЂРґ РїСЂРµРїРѕРґР°РІР°С‚РµР»СЏ: РјРµС‚СЂРёРєРё РїРѕ РІСЃРµРј РµРіРѕ РїСЂРѕРµРєС‚Р°Рј.
 * 3 СЂР°СѓРЅРґР° Р·Р°РїСЂРѕСЃРѕРІ (boards в†’ columns+members в†’ cards).
 */
export async function getTeacherDashboardData(): Promise<TeacherDashboardData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayKey()

  // Р Р°СѓРЅРґ 1: РїСЂРѕРµРєС‚С‹ РїСЂРµРїРѕРґР°РІР°С‚РµР»СЏ
  const { data: boardsRaw } = await supabase
    .from('boards')
    .select('id, title, created_at, status, completed_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const boards = boardsRaw ?? []
  const boardIds = boards.map((b) => b.id)

  if (boardIds.length === 0) {
    return {
      activeProjects: 0, totalStudents: 0, avgProgress: 0,
      needsAttentionCount: 0, attentionSignals: [], projects: [],
    }
  }

  // Р Р°СѓРЅРґ 2: РєРѕР»РѕРЅРєРё + СѓС‡Р°СЃС‚РЅРёРєРё (РїР°СЂР°Р»Р»РµР»СЊРЅРѕ)
  const [{ data: columnsRaw }, { data: membersRaw }] = await Promise.all([
    supabase.from('columns').select('id, board_id, title').in('board_id', boardIds),
    supabase.from('board_members').select('board_id, user_id').in('board_id', boardIds).neq('role', 'owner'),
  ])

  const columns = columnsRaw ?? []
  const members = membersRaw ?? []
  const allColumnIds = columns.map((c) => c.id)

  // Р Р°СѓРЅРґ 3: РєР°СЂС‚РѕС‡РєРё (РµСЃР»Рё РµСЃС‚СЊ РєРѕР»РѕРЅРєРё)
  const cardsRaw = allColumnIds.length > 0
    ? ((await supabase.from('cards').select('id, column_id, assignee_id, due_date').in('column_id', allColumnIds)).data ?? [])
    : []

  // РРЅРґРµРєСЃС‹ РґР»СЏ Р±С‹СЃС‚СЂРѕРіРѕ РїРѕРёСЃРєР°
  const colsByBoard = new Map<string, { id: string; isDone: boolean }[]>()
  for (const col of columns) {
    if (!colsByBoard.has(col.board_id)) colsByBoard.set(col.board_id, [])
    colsByBoard.get(col.board_id)!.push({ id: col.id, isDone: isDoneColumnTitle(col.title) })
  }

  const cardsByCol = new Map<string, typeof cardsRaw>()
  for (const card of cardsRaw) {
    if (!cardsByCol.has(card.column_id)) cardsByCol.set(card.column_id, [])
    cardsByCol.get(card.column_id)!.push(card)
  }

  const membersByBoard = new Map<string, string[]>()
  for (const m of members) {
    if (!membersByBoard.has(m.board_id)) membersByBoard.set(m.board_id, [])
    membersByBoard.get(m.board_id)!.push(m.user_id)
  }

  const attentionSignals: AttentionSignal[] = []
  const projects: TeacherProjectSummary[] = []
  let totalProgress = 0
  const uniqueStudentIds = new Set<string>()

  for (const board of boards) {
    const boardCols = colsByBoard.get(board.id) ?? []
    const studentIds = membersByBoard.get(board.id) ?? []
    studentIds.forEach((id) => uniqueStudentIds.add(id))

    let totalCards = 0
    let doneCards = 0
    let overdueCount = 0
    const assignedStudents = new Set<string>()

    for (const col of boardCols) {
      const colCards = cardsByCol.get(col.id) ?? []
      for (const card of colCards) {
        totalCards++
        if (col.isDone) {
          doneCards++
        } else if (card.due_date && card.due_date < today) {
          overdueCount++
        }
        if (card.assignee_id) assignedStudents.add(card.assignee_id)
      }
    }

    const completionRate = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0
    totalProgress += completionRate

    // РЎС‚СѓРґРµРЅС‚С‹ Р±РµР· РµРґРёРЅРѕР№ РЅР°Р·РЅР°С‡РµРЅРЅРѕР№ Р·Р°РґР°С‡Рё вЂ” РЅРёР·РєР°СЏ Р°РєС‚РёРІРЅРѕСЃС‚СЊ
    const lowActivityCount = studentIds.filter((id) => !assignedStudents.has(id)).length

    if (board.status === 'active') {
      if (overdueCount > 0) {
        attentionSignals.push({ boardId: board.id, boardTitle: board.title, type: 'overdue', count: overdueCount })
      }
      if (lowActivityCount > 0) {
        attentionSignals.push({ boardId: board.id, boardTitle: board.title, type: 'low_activity', count: lowActivityCount })
      }
    }

    projects.push({ id: board.id, title: board.title, created_at: board.created_at, studentCount: studentIds.length, completionRate, overdueCount, status: board.status as 'active' | 'completed', completed_at: board.completed_at ?? null })
  }

  const completedBoardIds = boards.filter((b) => b.status === 'completed').map((b) => b.id)
  if (completedBoardIds.length > 0) {
    const { data: gradedBoardsRaw } = await supabase
      .from('grades')
      .select('board_id')
      .in('board_id', completedBoardIds)
      .not('student_id', 'is', null)
    const gradedBoardSet = new Set((gradedBoardsRaw ?? []).map((g) => g.board_id))
    for (const completedBoard of boards.filter((b) => b.status === 'completed')) {
      const cStudentIds = membersByBoard.get(completedBoard.id) ?? []
      if (cStudentIds.length > 0 && !gradedBoardSet.has(completedBoard.id)) {
        attentionSignals.push({ boardId: completedBoard.id, boardTitle: completedBoard.title, type: 'completed_ungraded', count: cStudentIds.length })
      }
    }
  }

  return {
    activeProjects: boards.filter((b) => b.status === 'active').length,
    totalStudents: uniqueStudentIds.size,
    avgProgress: boards.length > 0 ? Math.round(totalProgress / boards.length) : 0,
    needsAttentionCount: attentionSignals.length,
    attentionSignals,
    projects,
  }
}

