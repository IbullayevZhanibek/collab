import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getProjectGradebook } from '@/actions/gradebook'
import { GradebookClient } from '@/components/gradebook/GradebookClient'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('gradebook')
  return { title: t('title') }
}

export default async function GradebookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('user_id', user.id)
    .single()

  if (profile?.global_role !== 'teacher') redirect('/dashboard')

  const { data: boards } = await supabase
    .from('boards')
    .select('id, title')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const boardList = (boards ?? []) as { id: string; title: string }[]

  const initialGradebook = boardList.length > 0
    ? ((await getProjectGradebook(boardList[0].id)).data ?? null)
    : null

  return (
    <GradebookClient
      boards={boardList}
      initialGradebook={initialGradebook}
    />
  )
}
