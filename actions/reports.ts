'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMonitoringData } from '@/actions/monitoring'
import type {
  StudentReportData,
  StudentReflection,
  ProjectReportData,
  TeacherOverviewItem,
  StudentDetailReport,
} from '@/lib/types'

const DONE_KEYWORDS = [
  'готово', 'done', 'завершено', 'выполнено',
  'completed', 'finished', 'сделано', 'ready',
]

function isDoneColumn(title: string): boolean {
  const lower = title.toLowerCase()
  return DONE_KEYWORDS.some((kw) => lower.includes(kw))
}

function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}

// ── Общий обзор для учителя (все его проекты) ────────────────────────────

export async function getTeacherOverviewReport(): Promise<{
  data: TeacherOverviewItem[]
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: boards } = await supabase
    .from('boards')
    .select('id, title')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (!boards?.length) return { data: [] }

  const boardIds = boards.map((b) => b.id)

  // Batch: все данные по всем доскам за 5 запросов
  const [
    { data: columnsRaw },
    { data: membersRaw },
    { data: stagesRaw },
    { data: criteriaRaw },
    { data: gradesRaw },
  ] = await Promise.all([
    supabase.from('columns').select('id, board_id, title').in('board_id', boardIds),
    supabase.from('board_members').select('board_id, role').in('board_id', boardIds),
    supabase.from('project_stages').select('board_id, status').in('board_id', boardIds),
    supabase.from('rubric_criteria').select('id, board_id, max_score').in('board_id', boardIds),
    supabase.from('grades').select('board_id, criterion_id, score, student_id').in('board_id', boardIds),
  ])

  const cols = columnsRaw ?? []
  const allColIds = cols.map((c) => c.id)

  const { data: cardsRaw } = allColIds.length > 0
    ? await supabase.from('cards').select('id, column_id').in('column_id', allColIds)
    : { data: [] as { id: string; column_id: string }[] }

  const cards    = cardsRaw    ?? []
  const members  = membersRaw  ?? []
  const stages   = stagesRaw   ?? []
  const criteria = criteriaRaw ?? []
  const grades   = gradesRaw   ?? []

  const result: TeacherOverviewItem[] = boards.map((board) => {
    const boardCols  = cols.filter((c) => c.board_id === board.id)
    const doneColIds = new Set(boardCols.filter((c) => isDoneColumn(c.title)).map((c) => c.id))
    const boardCards = cards.filter((c) => boardCols.some((col) => col.id === c.column_id))
    const completionRate = pct(boardCards.filter((c) => doneColIds.has(c.column_id)).length, boardCards.length)

    const boardStages  = stages.filter((s) => s.board_id === board.id)
    const stageProgress = pct(boardStages.filter((s) => s.status === 'done').length, boardStages.length)

    const studentCount = members.filter((m) => m.board_id === board.id && m.role !== 'owner').length

    const boardCriteria = criteria.filter((c) => c.board_id === board.id)
    const maxTotal      = boardCriteria.reduce((s, c) => s + c.max_score, 0)
    const projectGrades = grades.filter((g) => g.board_id === board.id && g.student_id === null)
    const avgScore =
      maxTotal > 0 && projectGrades.length > 0
        ? Math.round((projectGrades.reduce((s, g) => s + Number(g.score), 0) / maxTotal) * 100)
        : null

    const isActive = stageProgress < 100 || boardStages.length === 0

    return { boardId: board.id, boardTitle: board.title, studentCount, completionRate, stageProgress, avgScore, isActive }
  })

  return { data: result }
}

// ── Детальный отчёт по одному проекту ─────────────────────────────────────

export async function getProjectReport(
  boardId: string,
): Promise<{ data: ProjectReportData | null; error?: string }> {
  const { data: monData, error } = await getMonitoringData(boardId)
  if (error || !monData) return { data: null, error: error ?? 'Unknown error' }

  const supabase = await createClient()

  const [
    { data: criteriaRaw },
    { data: gradesRaw },
    { data: boardRaw },
    { data: reflRaw },
  ] = await Promise.all([
    supabase.from('rubric_criteria').select('id, max_score').eq('board_id', boardId),
    supabase.from('grades').select('criterion_id, score, student_id').eq('board_id', boardId),
    supabase.from('boards').select('id, title').eq('id', boardId).single(),
    supabase.rpc('get_project_reflections', { p_board_id: boardId }),
  ])

  const criteria      = criteriaRaw ?? []
  const grades        = gradesRaw   ?? []
  const maxTotal      = criteria.reduce((s, c) => s + c.max_score, 0)
  const projectGrades = grades.filter((g) => g.student_id === null)

  const students: StudentReportData[] = monData.students.map((s) => {
    const studentGrades  = grades.filter((g) => g.student_id === s.userId)
    const effectiveGrades = studentGrades.length > 0 ? studentGrades : projectGrades
    const gradeTotal     = effectiveGrades.reduce((sum, g) => sum + Number(g.score), 0)
    const hasGrade       = maxTotal > 0 && effectiveGrades.length > 0

    return {
      userId:           s.userId,
      fullName:         s.fullName,
      email:            s.email,
      teamRole:         s.teamRole,
      assignedCards:    s.assignedCards,
      doneCards:        s.doneCards,
      commentsCount:    s.commentsCount,
      linksCount:       s.linksCount,
      reflectionsCount: s.reflectionsCount,
      activityScore:    s.activityScore,
      activityLevel:    s.activityLevel,
      gradeScore:       hasGrade ? gradeTotal : null,
      gradeMax:         hasGrade ? maxTotal : null,
      gradePercent:     hasGrade ? Math.round((gradeTotal / maxTotal) * 100) : null,
    }
  })

  const gradedStudents = students.filter((s) => s.gradePercent !== null)
  const avgScore =
    gradedStudents.length > 0
      ? Math.round(gradedStudents.reduce((s, st) => s + (st.gradePercent ?? 0), 0) / gradedStudents.length)
      : null

  const avgActivityScore =
    students.length > 0
      ? Math.round(students.reduce((s, st) => s + st.activityScore, 0) / students.length)
      : 0

  const reflections: StudentReflection[] = ((reflRaw ?? []) as Record<string, unknown>[]).map((r) => ({
    studentId:    String(r.student_id),
    stageTitle:   (r.stage_title as string | null) ?? null,
    whatDone:     (r.what_done as string | null) ?? null,
    difficulties: (r.difficulties as string | null) ?? null,
    improvements: (r.improvements as string | null) ?? null,
    contribution: (r.contribution as string | null) ?? null,
    updatedAt:    String(r.updated_at),
  }))

  return {
    data: {
      boardId:          boardRaw?.id ?? boardId,
      boardTitle:       boardRaw?.title ?? '',
      students,
      project:          monData.project,
      avgScore,
      avgActivityScore,
      reflections,
    },
  }
}

// ── Детальный отчёт по одному студенту ────────────────────────────────────

export async function getStudentReport(
  boardId: string,
  studentId: string,
): Promise<{ data: StudentDetailReport | null; error?: string }> {
  const { data: projectReport, error } = await getProjectReport(boardId)
  if (error || !projectReport) return { data: null, error }

  const student = projectReport.students.find((s) => s.userId === studentId)
  if (!student) return { data: null, error: 'Student not found' }

  const reflections = projectReport.reflections.filter((r) => r.studentId === studentId)

  return { data: { ...student, reflections } }
}
