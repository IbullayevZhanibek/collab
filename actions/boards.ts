'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/actions/activity'
import type { ProjectInput } from '@/lib/types'

const orNull = (v?: string | null) => {
  const trimmed = v?.trim()
  return trimmed ? trimmed : null
}

/**
 * Создание учебного проекта (доски с образовательными полями).
 *
 * Принимает как строку (только название — обратная совместимость), так и
 * полный объект проекта со сроками, целью и этапами. Создавать проекты
 * может только преподаватель — это дополнительно гарантирует RLS-политика
 * «Teachers can create boards».
 */
export async function createBoard(input: string | ProjectInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const project: ProjectInput = typeof input === 'string' ? { title: input } : input
  const title = project.title.trim()
  if (!title) return { error: 'Введите название проекта' }

  const { data, error } = await supabase
    .from('boards')
    .insert({
      title,
      owner_id: user.id,
      description: orNull(project.description),
      goal: orNull(project.goal),
      expected_result: orNull(project.expected_result),
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      defense_format: orNull(project.defense_format),
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Этапы проекта вставляем отдельно. RLS «Owners can manage stages»
  // пропускает вставку, т.к. пользователь — владелец только что созданной доски.
  const stages = (project.stages ?? [])
    .map((s, i) => ({
      board_id: data.id,
      title: s.title.trim(),
      due_date: s.due_date || null,
      order_index: i,
    }))
    .filter((s) => s.title.length > 0)

  if (stages.length > 0) {
    const { error: stageError } = await supabase.from('project_stages').insert(stages)
    if (stageError) return { error: stageError.message }
  }

  revalidatePath('/dashboard')
  return { data }
}

export async function deleteBoard(boardId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', boardId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateBoardTitle(boardId: string, title: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('boards')
    .update({ title: title.trim() })
    .eq('id', boardId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function completeBoard(boardId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('boards')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq('id', boardId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  await logActivity(boardId, 'board_completed', {})
  revalidatePath('/dashboard')
  revalidatePath('/reports')
  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

export async function reopenBoard(boardId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('boards')
    .update({
      status: 'active',
      completed_at: null,
      completed_by: null,
    })
    .eq('id', boardId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  await logActivity(boardId, 'board_reopened', {})
  revalidatePath('/dashboard')
  revalidatePath('/reports')
  revalidatePath(`/board/${boardId}`)
  return { success: true }
}
