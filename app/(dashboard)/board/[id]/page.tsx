import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/board/KanbanBoard'

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: board }, { data: columns }, { data: cards }, { data: members }] =
    await Promise.all([
      supabase.from('boards').select('*').eq('id', id).single(),
      supabase
        .from('columns')
        .select('*')
        .eq('board_id', id)
        .order('position', { ascending: true }),
      supabase
        .from('cards')
        .select('*')
        .in(
          'column_id',
          (
            await supabase
              .from('columns')
              .select('id')
              .eq('board_id', id)
          ).data?.map((c) => c.id) ?? []
        )
        .order('position', { ascending: true }),
      supabase.from('board_members').select('count').eq('board_id', id),
    ])

  if (!board) notFound()

  const memberCount = members?.[0]?.count ?? 0

  return (
    <div className="flex flex-col h-screen">
      {/* Board header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 gap-3 min-w-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 sm:gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Назад</span>
          </Link>
          <div className="h-5 w-px bg-gray-200 shrink-0" />
          <h1 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{board.title}</h1>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-500 shrink-0">
          <Users size={16} />
          <span className="hidden sm:inline">{memberCount} участников</span>
          <span className="sm:hidden">{memberCount}</span>
        </div>
      </div>

      {/* Board body */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-x-auto p-6">
          <KanbanBoard
            boardId={id}
            userId={user.id}
            initialColumns={columns ?? []}
            initialCards={cards ?? []}
          />
        </div>
      </div>
    </div>
  )
}
