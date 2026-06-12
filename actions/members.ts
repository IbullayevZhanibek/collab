'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MemberWithProfile } from '@/lib/types'

export async function inviteMember(boardId: string, email: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: found, error: findError } = await supabase
    .rpc('find_user_by_email', { search_email: email.trim().toLowerCase() })

  if (findError || !found || found.length === 0) {
    return { error: 'Пользователь не найден' }
  }

  const target = found[0] as { user_id: string; full_name: string; email: string }

  if (target.user_id === user.id) {
    return { error: 'Нельзя пригласить себя' }
  }

  const { data: existing } = await supabase
    .from('board_members')
    .select('id')
    .eq('board_id', boardId)
    .eq('user_id', target.user_id)
    .maybeSingle()

  if (existing) {
    return { error: 'Пользователь уже является участником доски' }
  }

  const { error: insertError } = await supabase
    .from('board_members')
    .insert({ board_id: boardId, user_id: target.user_id, role: 'member' })

  if (insertError) return { error: insertError.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

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

export async function getMembers(boardId: string): Promise<{ data?: MemberWithProfile[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .rpc('get_board_members_with_info', { bid: boardId })

  if (error) return { error: error.message }

  return { data: (data ?? []) as MemberWithProfile[] }
}
