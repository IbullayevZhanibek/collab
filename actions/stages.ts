'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/actions/activity'
import type { ProjectStage, ProjectStageStatus } from '@/lib/types'

// Р­С‚Р°РїС‹ РїСЂРѕРµРєС‚Р° РїРѕ РїРѕСЂСЏРґРєСѓ. RLS В«Members can view stagesВ» РѕС‚РєСЂС‹РІР°РµС‚ РёС…
// РІСЃРµРј СѓС‡Р°СЃС‚РЅРёРєР°Рј РїСЂРѕРµРєС‚Р° (Рё СЃС‚СѓРґРµРЅС‚Р°Рј, Рё РїСЂРµРїРѕРґР°РІР°С‚РµР»СЋ).
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

// РЎРјРµРЅСѓ СЃС‚Р°С‚СѓСЃР° СЌС‚Р°РїР° RLS СЂР°Р·СЂРµС€Р°РµС‚ С‚РѕР»СЊРєРѕ РІР»Р°РґРµР»СЊС†Сѓ-РїСЂРµРїРѕРґР°РІР°С‚РµР»СЋ
// (РїРѕР»РёС‚РёРєР° В«Owners can manage stagesВ»).
export async function updateStageStatus(
  stageId: string,
  boardId: string,
  status: ProjectStageStatus,
  stageTitle: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('project_stages')
    .update({ status })
    .eq('id', stageId)

  if (error) return { error: error.message }

  await logActivity(boardId, 'stage_status_changed', { stageTitle, status })

  return { success: true }
}
