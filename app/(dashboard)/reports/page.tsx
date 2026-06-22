import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherOverviewReport } from '@/actions/reports'
import { ReportsClient } from '@/components/reports/ReportsClient'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reports')
  return { title: t('title') }
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('user_id', user.id)
    .single()

  if (profile?.global_role !== 'teacher') redirect('/dashboard')

  const { data: overview } = await getTeacherOverviewReport()

  return <ReportsClient overview={overview ?? []} />
}
