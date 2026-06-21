'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  MonitoringData,
  ProjectMetrics,
  StudentActivityMetric,
  TaskDistItem,
  TeamCollaborationMetrics,
  ActivityLevel,
} from '@/lib/types'

// Ключевые слова в названии колонки, которые обозначают «выполнено».
const DONE_KEYWORDS = [
  'готово', 'done', 'завершено', 'выполнено',
  'completed', 'finished', 'сделано', 'ready',
]

function isDoneColumn(title: string): boolean {
  const lower = title.toLowerCase()
  return DONE_KEYWORDS.some((kw) => lower.includes(kw))
}

function activityLevel(score: number): ActivityLevel {
  if (score >= 15) return 'active'
  if (score >= 5)  return 'low'
  return 'inactive'
}

function pct(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

// Индекс активности (взвешенная сумма):
//   задачи назначены  ×2  (вовлечённость)
//   задачи выполнены  ×3  (результативность, сверх назначенных)
//   комментарии       ×1  (коммуникация)
//   материалы         ×1  (ресурсный вклад)
//   рефлексии         ×3  (педагогическая рефлексия)
function computeScore(p: {
  assigned: number
  done: number
  comments: number
  links: number
  reflections: number
}): number {
  return (
    p.assigned * 2 +
    p.done * 3 +
    p.comments * 1 +
    p.links * 1 +
    p.reflections * 3
  )
}

const EMPTY_PROJECT: ProjectMetrics = {
  totalCards: 0, doneCards: 0, completionRate: 0,
  cardsWithDeadline: 0, onTimeCards: 0, deadlineCompliance: 0,
  overdueCount: 0, totalStages: 0, doneStages: 0, stageProgress: 0,
}

const EMPTY_COLLAB: TeamCollaborationMetrics = {
  totalComments: 0, totalLinks: 0,
  activeStudents: 0, totalStudents: 0,
  taskDistribution: [],
}

export async function getMonitoringData(
  boardId: string,
): Promise<{ data: MonitoringData | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Раунд 1: структура доски ─────────────────────────────────────────────
  const [
    { data: columnsRaw, error: colErr },
    { data: membersRaw },
    { data: stagesRaw },
    { data: reflectionsRaw },
  ] = await Promise.all([
    supabase.from('columns').select('id, title').eq('board_id', boardId),
    supabase.rpc('get_board_members_with_info', { bid: boardId }),
    supabase.from('project_stages').select('id, status').eq('board_id', boardId),
    supabase.from('reflections').select('student_id').eq('board_id', boardId),
  ])

  if (colErr) return { data: null, error: colErr.message }

  const columns = columnsRaw ?? []
  const columnIds = columns.map((c) => c.id)
  const doneColumnIds = new Set(
    columns.filter((c) => isDoneColumn(c.title)).map((c) => c.id),
  )

  if (columnIds.length === 0) {
    return {
      data: { project: EMPTY_PROJECT, students: [], collaboration: EMPTY_COLLAB },
    }
  }

  // ── Раунд 2: карточки ────────────────────────────────────────────────────
  const { data: cardsRaw } = await supabase
    .from('cards')
    .select('id, column_id, assignee_id, due_date')
    .in('column_id', columnIds)

  const cards = cardsRaw ?? []
  const cardIds = cards.map((c) => c.id)

  // ── Раунд 3: комментарии + ссылки (нужны id карточек) ──────────────────
  const [{ data: commentsRaw }, { data: linksRaw }] =
    cardIds.length > 0
      ? await Promise.all([
          supabase.from('comments').select('user_id').in('card_id', cardIds),
          supabase.from('card_links').select('user_id').in('card_id', cardIds),
        ])
      : [{ data: [] as { user_id: string }[] }, { data: [] as { user_id: string }[] }]

  const today = new Date().toISOString().slice(0, 10)
  const comments  = commentsRaw  ?? []
  const links     = linksRaw     ?? []
  const reflections = reflectionsRaw ?? []
  const stages    = stagesRaw    ?? []

  // ── Метрики проекта ──────────────────────────────────────────────────────
  const totalCards = cards.length
  const doneCards  = cards.filter((c) => doneColumnIds.has(c.column_id)).length

  const cardsWithDeadline = cards.filter((c) => !!c.due_date).length
  const onTimeCards = cards.filter(
    (c) => c.due_date && (doneColumnIds.has(c.column_id) || c.due_date >= today),
  ).length
  const overdueCount = cards.filter(
    (c) => c.due_date && c.due_date < today && !doneColumnIds.has(c.column_id),
  ).length

  const totalStages = stages.length
  const doneStages  = stages.filter((s) => s.status === 'done').length

  const project: ProjectMetrics = {
    totalCards, doneCards,
    completionRate:      pct(doneCards, totalCards),
    cardsWithDeadline,  onTimeCards,
    deadlineCompliance:  pct(onTimeCards, cardsWithDeadline),
    overdueCount,
    totalStages, doneStages,
    stageProgress: pct(doneStages, totalStages),
  }

  // ── Метрики по студентам ─────────────────────────────────────────────────
  const allMembers = (membersRaw ?? []) as {
    user_id: string
    role: string
    team_role: string | null
    full_name: string | null
    email: string
  }[]
  const studentMembers = allMembers.filter((m) => m.role !== 'owner')

  const studentMetrics: StudentActivityMetric[] = studentMembers.map((m) => {
    const assigned       = cards.filter((c) => c.assignee_id === m.user_id)
    const done           = assigned.filter((c) => doneColumnIds.has(c.column_id))
    const myComments     = comments.filter((c) => c.user_id === m.user_id)
    const myLinks        = links.filter((l) => l.user_id === m.user_id)
    const myReflections  = reflections.filter((r) => r.student_id === m.user_id)

    const score = computeScore({
      assigned:    assigned.length,
      done:        done.length,
      comments:    myComments.length,
      links:       myLinks.length,
      reflections: myReflections.length,
    })

    return {
      userId:          m.user_id,
      fullName:        m.full_name,
      email:           m.email,
      teamRole:        m.team_role,
      assignedCards:   assigned.length,
      doneCards:       done.length,
      commentsCount:   myComments.length,
      linksCount:      myLinks.length,
      reflectionsCount: myReflections.length,
      activityScore:   score,
      activityLevel:   activityLevel(score),
    }
  })

  // ── Командные метрики ────────────────────────────────────────────────────
  const activeStudents = studentMetrics.filter((s) => s.activityLevel === 'active').length

  const taskDistribution: TaskDistItem[] = studentMetrics.map((s) => ({
    name:     s.fullName?.split(' ')[0] ?? s.email.split('@')[0],
    assigned: s.assignedCards,
    done:     s.doneCards,
  }))

  const collaboration: TeamCollaborationMetrics = {
    totalComments:  comments.length,
    totalLinks:     links.length,
    activeStudents,
    totalStudents:  studentMembers.length,
    taskDistribution,
  }

  return { data: { project, students: studentMetrics, collaboration } }
}
