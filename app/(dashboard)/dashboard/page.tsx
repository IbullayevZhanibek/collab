import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats, getImportantNotifications } from '@/actions/dashboard'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { Notifications } from '@/components/dashboard/Notifications'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .single()

  const firstName = (profile?.full_name || user.email?.split('@')[0] || 'друг').split(' ')[0]

  const [boardsResult, stats, notifications] = await Promise.all([
    supabase
      .from('boards')
      .select('*, board_members(count)')
      .order('created_at', { ascending: false }),
    getDashboardStats(),
    getImportantNotifications(),
  ])

  const boards = boardsResult.data

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Приветствие */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Привет, {firstName}!
          </h1>
          <p className="text-gray-500 text-sm mt-1">Вот что происходит по вашим задачам</p>
        </div>

        {/* Статистика */}
        <StatsCards stats={stats} />

        {/* Важные уведомления */}
        <Notifications items={notifications.data} />

        {/* Список досок */}
        <DashboardClient boards={boards ?? []} currentUserId={user.id} />
      </div>
    </div>
  )
}
