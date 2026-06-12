'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createCard(
  columnId: string,
  boardId: string,
  data: {
    title: string
    description?: string
    priority?: string
    due_date?: string
    assignee_id?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('cards')
    .select('position')
    .eq('column_id', columnId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { data: card, error } = await supabase
    .from('cards')
    .insert({
      column_id: columnId,
      title: data.title.trim(),
      description: data.description || null,
      priority: data.priority || null,
      due_date: data.due_date || null,
      assignee_id: data.assignee_id || null,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  revalidatePath('/tasks')
  return { data: card }
}

export async function updateCard(
  cardId: string,
  boardId: string,
  updates: {
    title?: string
    description?: string
    priority?: string | null
    due_date?: string | null
    assignee_id?: string | null
    column_id?: string
    position?: number
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  revalidatePath('/tasks')
  return { success: true }
}

export async function deleteCard(cardId: string, boardId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  revalidatePath('/tasks')
  return { success: true }
}

export async function moveCard(
  cardId: string,
  targetColumnId: string,
  targetPosition: number,
  boardId: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cards')
    .update({ column_id: targetColumnId, position: targetPosition })
    .eq('id', cardId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  revalidatePath('/tasks')
  return { success: true }
}

export async function reorderCards(
  boardId: string,
  cards: { id: string; position: number; column_id: string }[]
) {
  const supabase = await createClient()

  const updates = cards.map(({ id, position, column_id }) =>
    supabase.from('cards').update({ position, column_id }).eq('id', id)
  )

  await Promise.all(updates)
  revalidatePath(`/board/${boardId}`)
  return { success: true }
}
