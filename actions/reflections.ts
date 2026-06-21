'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Reflection, ReflectionWithMeta } from '@/lib/types'

export async function getMyReflections(
  boardId: string,
): Promise<{ data: Reflection[] | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('reflections')
    .select('*')
    .eq('board_id', boardId)
    .eq('student_id', user.id)
    .order('created_at', { ascending: true })

  return { data: data as Reflection[] | null, error: error?.message }
}

export async function getMyReflectionForStage(
  boardId: string,
  stageId: string | null,
): Promise<{ data: Reflection | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('reflections')
    .select('*')
    .eq('board_id', boardId)
    .eq('student_id', user.id)

  query = stageId ? query.eq('stage_id', stageId) : query.is('stage_id', null)

  const { data, error } = await query.maybeSingle()
  return { data: data as Reflection | null, error: error?.message }
}

export async function saveReflection(
  boardId: string,
  stageId: string | null,
  payload: {
    whatDone: string
    difficulties: string
    improvements: string
    contribution: string
  },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let checkQuery = supabase
    .from('reflections')
    .select('id')
    .eq('board_id', boardId)
    .eq('student_id', user.id)

  checkQuery = stageId
    ? checkQuery.eq('stage_id', stageId)
    : checkQuery.is('stage_id', null)

  const { data: existing } = await checkQuery.maybeSingle()

  const fields = {
    what_done:    payload.whatDone.trim()     || null,
    difficulties: payload.difficulties.trim() || null,
    improvements: payload.improvements.trim() || null,
    contribution: payload.contribution.trim() || null,
    updated_at:   new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase
      .from('reflections')
      .update(fields)
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('reflections')
      .insert({ board_id: boardId, stage_id: stageId, student_id: user.id, ...fields })
    if (error) return { error: error.message }
  }

  return {}
}

export async function getProjectReflections(
  boardId: string,
): Promise<{ data: ReflectionWithMeta[] | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.rpc('get_project_reflections', {
    p_board_id: boardId,
  })

  return { data: data as ReflectionWithMeta[] | null, error: error?.message }
}
