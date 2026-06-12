'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createBoard(title: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('boards')
    .insert({ title: title.trim(), owner_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

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
