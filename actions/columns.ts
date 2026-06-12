'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createColumn(boardId: string, title: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('columns')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { data, error } = await supabase
    .from('columns')
    .insert({ board_id: boardId, title: title.trim(), position: nextPosition })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { data }
}

export async function deleteColumn(columnId: string, boardId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('columns')
    .delete()
    .eq('id', columnId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

export async function updateColumnTitle(columnId: string, title: string, boardId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('columns')
    .update({ title: title.trim() })
    .eq('id', columnId)

  if (error) return { error: error.message }

  revalidatePath(`/board/${boardId}`)
  return { success: true }
}

export async function reorderColumns(boardId: string, columns: { id: string; position: number }[]) {
  const supabase = await createClient()

  const updates = columns.map(({ id, position }) =>
    supabase.from('columns').update({ position }).eq('id', id)
  )

  await Promise.all(updates)
  revalidatePath(`/board/${boardId}`)
  return { success: true }
}
