import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/board/KanbanBoard'
import { MembersButton } from '@/components/board/MembersButton'
import { ActivityLog } from '@/components/board/ActivityLog'
import { GradingButton } from '@/components/board/GradingButton'
import { ReflectionButton } from '@/components/board/ReflectionButton'
import { MonitoringButton } from '@/components/board/MonitoringButton'
import { ProjectStages } from '@/components/board/ProjectStages'
import { ProjectOverview } from '@/components/board/ProjectOverview'
import { getBoardInvitations } from '@/actions/invitations'
import type { Metadata } from 'next'
import type { MemberWithProfile, BoardInvitation, Card, ProjectStage } from '@/lib/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: board } = await supabase
    .from('boards')
    .select('title')
    .eq('id', id)
    .single()

  return { title: board?.title ?? 'Доска' }
}

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: board }, { data: columns }, { data: cardsRaw }, { data: membersRaw }, { data: stagesRaw }] =
    await Promise.all([
      supabase.from('boards').select('*').eq('id', id).single(),
      supabase
        .from('columns')
        .select('*')
        .eq('board_id', id)
        .order('position', { ascending: true }),
      // Карточки одним запросом через inner-join на columns по board_id —
      // раньше тут шли два последовательных запроса (id колонок → cards.in()).
      supabase
        .from('cards')
        .select('*, columns!inner(board_id)')
        .eq('columns.board_id', id)
        .order('position', { ascending: true }),
      supabase.rpc('get_board_members_with_info', { bid: id }),
      supabase
        .from('project_stages')
        .select('*')
        .eq('board_id', id)
        .order('order_index', { ascending: true }),
    ])

  if (!board) notFound()

  // Убираем вспомогательное вложенное поле columns, добавленное только для фильтра.
  const cards = ((cardsRaw ?? []) as Record<string, unknown>[]).map((row) => {
    const card = { ...row }
    delete card.columns
    return card
  }) as unknown as Card[]

  const members = (membersRaw ?? []) as MemberWithProfile[]
  const stages = (stagesRaw ?? []) as ProjectStage[]
  const isOwner = board.owner_id === user.id
  const t = await getTranslations('board')

  // Отправленные приглашения видны только владельцу доски.
  // Загрузка приглашений не должна влиять на отрисовку шапки и кнопки
  // «Участники» — при любой ошибке просто показываем пустой список.
  let invitations: BoardInvitation[] = []
  if (isOwner) {
    try {
      const res = await getBoardInvitations(id)
      invitations = res.data ?? []
    } catch {
      invitations = []
    }
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-gray-50">
      {/* Board header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between flex-shrink-0 gap-3 min-w-0 sticky top-14 md:top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 sm:gap-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-2 py-1.5 -ml-2 transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">{t('backToBoards')}</span>
          </Link>
          <div className="h-5 w-px bg-gray-200 shrink-0" />
          <h1 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{board.title}</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ActivityLog boardId={id} />
          {isOwner && <MonitoringButton boardId={id} />}
          <GradingButton
            boardId={id}
            currentUserId={user.id}
            isOwner={isOwner}
            members={members}
          />
          <ReflectionButton
            boardId={id}
            currentUserId={user.id}
            isOwner={isOwner}
            stages={stages}
            members={members}
          />
          <MembersButton
            boardId={id}
            currentUserId={user.id}
            isOwner={isOwner}
            members={members}
            invitations={invitations}
          />
        </div>
      </div>

      {/* Board body */}
      <div className="flex-1 bg-gray-50">
        <div className="h-full overflow-x-auto p-4 sm:p-6">
          {/* Образовательный контекст проекта: описание/цель/сроки + этапы */}
          <ProjectOverview board={board} />
          <ProjectStages boardId={id} stages={stages} canToggle={true} />
          <KanbanBoard
            boardId={id}
            userId={user.id}
            isOwner={isOwner}
            initialColumns={columns ?? []}
            initialCards={cards}
            members={members}
          />
        </div>
      </div>
    </div>
  )
}
