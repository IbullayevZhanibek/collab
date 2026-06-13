'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MyInvitation, BoardInvitation } from '@/lib/types'

export async function sendInvitation(boardId: string, email: string) {
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

  // Уже участник доски?
  const { data: member } = await supabase
    .from('board_members')
    .select('id')
    .eq('board_id', boardId)
    .eq('user_id', target.user_id)
    .maybeSingle()

  if (member) {
    return { error: 'Пользователь уже является участником доски' }
  }

  // Уже есть приглашение?
  const { data: existing } = await supabase
    .from('board_invitations')
    .select('id, status')
    .eq('board_id', boardId)
    .eq('invitee_id', target.user_id)
    .maybeSingle()

  if (existing?.status === 'pending') {
    return { error: 'Пользователь уже приглашён' }
  }

  // Если приглашение было отклонено ранее — повторно переводим его в pending.
  if (existing) {
    const { error: updateError } = await supabase
      .from('board_invitations')
      .update({ status: 'pending', inviter_id: user.id })
      .eq('id', existing.id)

    if (updateError) return { error: updateError.message }
  } else {
    const { error: insertError } = await supabase
      .from('board_invitations')
      .insert({ board_id: boardId, inviter_id: user.id, invitee_id: target.user_id })

    if (insertError) return { error: insertError.message }
  }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

export async function acceptInvitation(invitationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Меняет статус на accepted И добавляет пользователя в board_members.
  const { error } = await supabase.rpc('accept_invitation', { inv_id: invitationId })

  if (error) return { error: error.message }

  revalidatePath('/invitations')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function declineInvitation(invitationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('board_invitations')
    .update({ status: 'declined' })
    .eq('id', invitationId)
    .eq('invitee_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/invitations')
  return { success: true }
}

export async function getMyInvitations(): Promise<{ data?: MyInvitation[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.rpc('get_my_invitations')

  if (error) return { error: error.message }

  return { data: (data ?? []) as MyInvitation[] }
}

export async function getBoardInvitations(
  boardId: string,
): Promise<{ data?: BoardInvitation[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .rpc('get_board_invitations', { bid: boardId })

  if (error) return { error: error.message }

  return { data: (data ?? []) as BoardInvitation[] }
}
