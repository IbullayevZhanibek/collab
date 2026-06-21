'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CommentWithAuthor } from '@/lib/types'

export async function getComments(
  cardId: string,
): Promise<{ data?: CommentWithAuthor[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.rpc('get_card_comments', { p_card_id: cardId })
  if (error) return { error: error.message }
  return { data: (data ?? []) as CommentWithAuthor[] }
}

export async function addComment(
  cardId: string,
  boardId: string,
  body: string,
  isFeedback = false,
): Promise<{ data?: { id: string }; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Введите текст комментария' }

  // is_feedback может ставить только владелец доски (преподаватель).
  let feedbackFlag = false
  if (isFeedback) {
    const { data: board } = await supabase
      .from('boards')
      .select('owner_id')
      .eq('id', boardId)
      .single()
    feedbackFlag = board?.owner_id === user.id
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({ card_id: cardId, user_id: user.id, body: trimmed, is_feedback: feedbackFlag })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/board/${boardId}`)
  return { data: data as { id: string } }
}

export async function deleteComment(
  commentId: string,
  boardId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS «Authors can delete own comments» гарантирует что удалит только автор.
  const { error } = await supabase.from('comments').delete().eq('id', commentId)
  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return {}
}

export async function getCommentsCount(
  cardId: string,
): Promise<{ count?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count, error } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId)

  if (error) return { error: error.message }
  return { count: count ?? 0 }
}

// Один запрос для всех карточек доски — используется в KanbanBoard.
export async function getBulkCommentsCounts(
  cardIds: string[],
): Promise<{ data?: Record<string, number>; error?: string }> {
  if (!cardIds.length) return { data: {} }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('comments')
    .select('card_id')
    .in('card_id', cardIds)

  if (error) return { error: error.message }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.card_id] = (counts[row.card_id] ?? 0) + 1
  }
  return { data: counts }
}
