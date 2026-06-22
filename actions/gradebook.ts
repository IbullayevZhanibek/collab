'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  FinalGrade,
  ProjectGradebookData,
  GradebookStudentEntry,
  RubricCriterion,
} from '@/lib/types'

// ── Вспомогательная функция ──

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0
}

// ── Журнал по одному проекту ──

export async function getProjectGradebook(boardId: string): Promise<{
  data?: ProjectGradebookData
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: board } = await supabase
    .from('boards')
    .select('id, title')
    .eq('id', boardId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!board) return { error: 'Access denied' }

  const [
    { data: criteriaRaw, error: cErr },
    { data: membersRaw, error: mErr },
    { data: gradesRaw,  error: gErr },
    { data: fgRaw,      error: fErr },
  ] = await Promise.all([
    supabase.from('rubric_criteria').select('*').eq('board_id', boardId).order('order_index'),
    supabase.rpc('get_board_members_with_info', { bid: boardId }),
    supabase.from('grades').select('*').eq('board_id', boardId),
    supabase.from('final_grades').select('*').eq('board_id', boardId),
  ])

  if (cErr) return { error: cErr.message }
  if (mErr) return { error: mErr.message }
  if (gErr) return { error: gErr.message }
  if (fErr) return { error: fErr.message }

  const criteria    = (criteriaRaw ?? []) as RubricCriterion[]
  const allMembers  = (membersRaw  ?? []) as Array<{
    user_id: string; role: string; team_role: string | null
    full_name: string | null; email: string
  }>
  const grades     = gradesRaw ?? []
  const finalGrades = (fgRaw ?? []) as FinalGrade[]

  const students = allMembers.filter((m) => m.role === 'member')
  const rubricMax = criteria.reduce((s, c) => s + c.max_score, 0)

  function buildEntry(
    studentId: string | null,
    studentName: string | null,
    studentEmail: string,
    teamRole: string | null,
  ): GradebookStudentEntry {
    const sg = grades.filter((g) =>
      studentId === null ? g.student_id === null : g.student_id === studentId,
    )
    const fg = finalGrades.find((f) =>
      studentId === null ? f.student_id === null : f.student_id === studentId,
    )

    const criteriaScores = criteria.map((c) => {
      const grade = sg.find((g) => g.criterion_id === c.id)
      return {
        criterionId: c.id,
        score:   grade != null ? Number(grade.score) : null,
        comment: grade?.comment ?? null,
      }
    })

    const rubricTotal   = criteriaScores.reduce((s, cs) => s + (cs.score ?? 0), 0)
    const rubricPercent = criteriaScores.some((cs) => cs.score !== null)
      ? pct(rubricTotal, rubricMax)
      : 0

    return {
      studentId,
      studentName,
      studentEmail,
      teamRole,
      criteriaScores,
      rubricTotal,
      rubricMax,
      rubricPercent,
      finalScore:    fg ? Number(fg.final_score) : null,
      finalMax:      fg ? Number(fg.max_score)   : 100,
      finalComment:  fg?.comment ?? null,
      hasFinalGrade: !!fg,
    }
  }

  const studentEntries = students.map((s) =>
    buildEntry(s.user_id, s.full_name, s.email, s.team_role),
  )
  const projectEntry = buildEntry(null, null, '', null)

  const gradedStudents = studentEntries.filter(
    (e) => e.hasFinalGrade || e.criteriaScores.some((cs) => cs.score !== null),
  )
  const avgRubricPercent =
    gradedStudents.length > 0
      ? Math.round(
          gradedStudents.reduce((s, e) => s + e.rubricPercent, 0) / gradedStudents.length,
        )
      : null

  return {
    data: {
      boardId:        board.id,
      boardTitle:     board.title,
      criteria,
      entries:        [...studentEntries, projectEntry],
      avgRubricPercent,
      gradedCount:    gradedStudents.length,
      totalStudents:  students.length,
    },
  }
}

// ── Выставить итоговую оценку ──

export async function setFinalGrade(
  boardId:   string,
  studentId: string | null,
  score:     number,
  maxScore  = 100,
  comment?:  string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const safeScore    = Number.isFinite(score) ? Math.max(0, score) : 0
  const safeMax      = Math.max(1, maxScore)
  const trimComment  = comment?.trim() || null

  let q = supabase
    .from('final_grades')
    .select('id')
    .eq('board_id', boardId)
  q = studentId === null ? q.is('student_id', null) : q.eq('student_id', studentId)

  const { data: existing } = await q.maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('final_grades')
      .update({
        final_score: safeScore,
        max_score:   safeMax,
        comment:     trimComment,
        graded_by:   user.id,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('final_grades')
      .insert({
        board_id:    boardId,
        student_id:  studentId,
        final_score: safeScore,
        max_score:   safeMax,
        comment:     trimComment,
        graded_by:   user.id,
      })
    if (error) return { error: error.message }
  }

  revalidatePath('/gradebook')
  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

// ── Итоговая оценка одного студента (для GradingButton) ──

export async function getStudentFinalGrade(
  boardId:   string,
  studentId: string | null,
): Promise<{ data?: FinalGrade | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let q = supabase
    .from('final_grades')
    .select('*')
    .eq('board_id', boardId)
  q = studentId === null ? q.is('student_id', null) : q.eq('student_id', studentId)

  const { data, error } = await q.maybeSingle()
  if (error) return { error: error.message }
  return { data: data as FinalGrade | null }
}
