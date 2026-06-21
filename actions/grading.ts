'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import type { RubricCriterion, Grade, ProjectScore } from '@/lib/types'

// Стандартная дипломная рубрика: 7 критериев = 100 баллов.
// Заголовки локализуются на момент применения (grading.standard.*).
const STANDARD_RUBRIC: { key: string; max: number }[] = [
  { key: 'relevance', max: 10 },
  { key: 'research', max: 15 },
  { key: 'design', max: 15 },
  { key: 'implementation', max: 25 },
  { key: 'teamwork', max: 10 },
  { key: 'documentation', max: 10 },
  { key: 'presentation', max: 15 },
]

// ── Критерии ──

export async function getRubric(
  boardId: string,
): Promise<{ data?: RubricCriterion[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('rubric_criteria')
    .select('*')
    .eq('board_id', boardId)
    .order('order_index', { ascending: true })

  if (error) return { error: error.message }
  return { data: (data ?? []) as RubricCriterion[] }
}

export async function addCriterion(boardId: string, title: string, maxScore: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trimmed = title.trim()
  if (!trimmed) return { error: 'Введите название критерия' }

  // Новый критерий встаёт в конец списка.
  const { data: last } = await supabase
    .from('rubric_criteria')
    .select('order_index')
    .eq('board_id', boardId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextIndex = (last?.order_index ?? -1) + 1

  // RLS «Owners manage criteria» гарантирует, что вставит только преподаватель.
  const { data, error } = await supabase
    .from('rubric_criteria')
    .insert({ board_id: boardId, title: trimmed, max_score: Math.max(0, Math.round(maxScore)), order_index: nextIndex })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { data: data as RubricCriterion }
}

export async function updateCriterion(
  boardId: string,
  criterionId: string,
  patch: { title?: string; max_score?: number },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const update: { title?: string; max_score?: number } = {}
  if (patch.title !== undefined) {
    const trimmed = patch.title.trim()
    if (!trimmed) return { error: 'Введите название критерия' }
    update.title = trimmed
  }
  if (patch.max_score !== undefined) update.max_score = Math.max(0, Math.round(patch.max_score))

  const { error } = await supabase
    .from('rubric_criteria')
    .update(update)
    .eq('id', criterionId)
    .eq('board_id', boardId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

export async function deleteCriterion(boardId: string, criterionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('rubric_criteria')
    .delete()
    .eq('id', criterionId)
    .eq('board_id', boardId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

// Применить стандартную рубрику. Только если критериев ещё нет —
// чтобы случайно не задублировать существующую разметку.
export async function applyStandardRubric(boardId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count } = await supabase
    .from('rubric_criteria')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId)

  if ((count ?? 0) > 0) return { error: 'Рубрика уже создана' }

  const t = await getTranslations('grading.standard')
  const rows = STANDARD_RUBRIC.map((c, i) => ({
    board_id: boardId,
    title: t(c.key),
    max_score: c.max,
    order_index: i,
  }))

  const { error } = await supabase.from('rubric_criteria').insert(rows)
  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

// ── Оценки ──

export async function getGrades(
  boardId: string,
  studentId?: string | null,
): Promise<{ data?: Grade[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase.from('grades').select('*').eq('board_id', boardId)
  // RLS уже ограничивает выдачу (студент видит только свои/общие).
  // Доп. фильтр по studentId — для адресной выборки в UI.
  if (studentId === null) query = query.is('student_id', null)
  else if (typeof studentId === 'string') query = query.eq('student_id', studentId)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { data: (data ?? []) as Grade[] }
}

// Выставить или обновить оценку по критерию для проекта (studentId = null)
// или конкретного студента. Upsert делаем вручную, т.к. unique(criterion_id,
// student_id) не покрывает NULL — для общих оценок используется частичный
// индекс grades_criterion_project_unique, на который onConflict не нацелить.
export async function setGrade(
  boardId: string,
  criterionId: string,
  studentId: string | null,
  score: number,
  comment: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0
  const trimmedComment = comment.trim() || null

  // Ищем существующую оценку (NULL-aware).
  let existingQuery = supabase
    .from('grades')
    .select('id')
    .eq('board_id', boardId)
    .eq('criterion_id', criterionId)
  existingQuery = studentId === null
    ? existingQuery.is('student_id', null)
    : existingQuery.eq('student_id', studentId)

  const { data: existing } = await existingQuery.maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('grades')
      .update({ score: safeScore, comment: trimmedComment, graded_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('grades')
      .insert({
        board_id: boardId,
        criterion_id: criterionId,
        student_id: studentId,
        score: safeScore,
        comment: trimmedComment,
        graded_by: user.id,
      })
    if (error) return { error: error.message }
  }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

// Итоговый балл: сумма выставленных оценок и максимум по всем критериям.
export async function getProjectScore(
  boardId: string,
  studentId?: string | null,
): Promise<{ data?: ProjectScore; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: criteria, error: cErr }, gradesResult] = await Promise.all([
    supabase.from('rubric_criteria').select('max_score').eq('board_id', boardId),
    getGrades(boardId, studentId ?? null),
  ])

  if (cErr) return { error: cErr.message }
  if (gradesResult.error) return { error: gradesResult.error }

  const max = (criteria ?? []).reduce((sum, c) => sum + (c.max_score ?? 0), 0)
  const grades = gradesResult.data ?? []
  const total = grades.reduce((sum, g) => sum + Number(g.score ?? 0), 0)
  const percent = max > 0 ? Math.round((total / max) * 100) : 0

  return { data: { total, max, percent, graded: grades.length } }
}
