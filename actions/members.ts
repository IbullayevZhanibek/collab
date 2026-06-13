'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/actions/activity'
import type { MemberWithProfile } from '@/lib/types'

export async function removeMember(boardId: string, userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS "Owners can manage members" enforces that only the board owner can delete.
  // We additionally guard against removing the owner row itself.
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .eq('role', 'member')

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

export async function leaveBoard(boardId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Проверяем, что пользователь — обычный участник, а не владелец.
  const { data: membership } = await supabase
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return { error: 'Вы не участник этой доски' }
  if (membership.role !== 'member') {
    return { error: 'Владелец не может покинуть свою доску' }
  }

  // Пишем в лог ДО удаления: после выхода доступа к доске уже не будет
  // и RLS не пропустит вставку в activity_log.
  await logActivity(boardId, 'member_left')

  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .eq('role', 'member')

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function getMembers(boardId: string): Promise<{ data?: MemberWithProfile[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .rpc('get_board_members_with_info', { bid: boardId })

  if (error) return { error: error.message }

  return { data: (data ?? []) as MemberWithProfile[] }
}
