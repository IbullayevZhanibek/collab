'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProjectStage, ProjectStageStatus } from '@/lib/types'

// Этапы проекта по порядку. RLS «Members can view stages» открывает их
// всем участникам проекта (и студентам, и преподавателю).
export async function getStages(
  boardId: string,
): Promise<{ data?: ProjectStage[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('project_stages')
    .select('*')
    .eq('board_id', boardId)
    .order('order_index', { ascending: true })

  if (error) return { error: error.message }
  return { data: (data ?? []) as ProjectStage[] }
}

// Смену статуса этапа RLS разрешает только владельцу-преподавателю
// (политика «Owners can manage stages»).
export async function updateStageStatus(
  stageId: string,
  boardId: string,
  status: ProjectStageStatus,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('project_stages')
    .update({ status })
    .eq('id', stageId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}
