'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Attachment } from '@/lib/types'

export async function getAttachments(
  cardId: string
): Promise<{ data?: Attachment[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data as Attachment[] }
}

export async function createAttachment(attachment: {
  card_id: string
  file_name: string
  file_size: number
  file_type: string | null
  storage_path: string
}): Promise<{ data?: Attachment; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('attachments')
    .insert({ ...attachment, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: data as Attachment }
}

export async function deleteAttachment(
  attachmentId: string,
  storagePath: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Remove from Storage first
  const { error: storageError } = await supabase.storage
    .from('card-attachments')
    .remove([storagePath])

  if (storageError) return { error: storageError.message }

  // Remove DB record (RLS enforces ownership)
  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return {}
}

export async function getDownloadUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.storage
    .from('card-attachments')
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
