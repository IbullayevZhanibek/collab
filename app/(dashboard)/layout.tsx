import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { PostHogIdentify } from '@/components/PostHogIdentify'
import { getMyInvitations } from '@/actions/invitations'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .single()

  const { data: invitations } = await getMyInvitations()
  const invitationCount = invitations?.length ?? 0

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Пользователь'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <PostHogIdentify userId={user.id} email={user.email ?? ''} name={displayName} />
      <Sidebar displayName={displayName} initials={initials} email={user.email ?? ''} invitationCount={invitationCount} />

      {/* Main — offset for desktop sidebar, offset for mobile top bar */}
      <main className="flex-1 md:ml-64 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
