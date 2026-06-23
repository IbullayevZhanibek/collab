import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ReflectionsClient } from './ReflectionsClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('diaryPage')
  return { title: t('title') }
}

export default async function ReflectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('user_id', user.id)
    .single()

  const isTeacher = profile?.global_role === 'teacher'

  // Teachers see their own boards; students see boards they belong to (RLS handles the filter).
  const boardsQuery = isTeacher
    ? supabase.from('boards').select('id, title').eq('owner_id', user.id).eq('status', 'active').order('created_at', { ascending: false })
    : supabase.from('boards').select('id, title').eq('status', 'active').order('created_at', { ascending: false })

  const { data: boardsRaw } = await boardsQuery

  const boards = (boardsRaw ?? []).map((b) => ({ id: b.id, title: b.title }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <ReflectionsClient
          boards={boards}
          currentUserId={user.id}
          isTeacher={isTeacher}
        />
      </div>
    </div>
  )
}
