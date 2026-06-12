import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: boards } = await supabase
    .from('boards')
    .select('*, board_members(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <DashboardClient boards={boards ?? []} />
      </div>
    </div>
  )
}
