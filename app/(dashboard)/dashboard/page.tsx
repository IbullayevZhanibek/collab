import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Главная' }
import { getDashboardData } from '@/actions/dashboard'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { Notifications } from '@/components/dashboard/Notifications'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, global_role')
    .eq('user_id', user.id)
    .single()

  const globalRole: 'teacher' | 'student' = profile?.global_role === 'teacher' ? 'teacher' : 'student'

  const t = await getTranslations('dashboard')
  const firstName = (profile?.full_name || user.email?.split('@')[0] || t('friendFallback')).split(' ')[0]

  const [boardsResult, { stats, notifications }] = await Promise.all([
    supabase
      .from('boards')
      .select('*, board_members(count)')
      .order('created_at', { ascending: false }),
    getDashboardData(),
  ])

  const boards = boardsResult.data

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Приветствие */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t('greeting', { name: firstName })}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
        </div>

        {/* Статистика */}
        <StatsCards stats={stats} />

        {/* Важные уведомления */}
        <Notifications items={notifications} />

        {/* Список досок */}
        <DashboardClient boards={boards ?? []} currentUserId={user.id} globalRole={globalRole} />
      </div>
    </div>
  )
}
