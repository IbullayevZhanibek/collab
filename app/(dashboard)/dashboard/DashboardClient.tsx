'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Plus, Trash2, LogOut, Users, LayoutDashboard } from 'lucide-react'
import { deleteBoard } from '@/actions/boards'
import { leaveBoard } from '@/actions/members'
import { CreateBoardDialog } from '@/components/dashboard/CreateBoardDialog'
import { Button } from '@/components/ui/button'
import { cn, getBoardColor } from '@/lib/utils'

interface Board {
  id: string
  title: string
  owner_id: string
  created_at: string
  board_members: { count: number }[]
}

interface DashboardClientProps {
  boards: Board[]
  currentUserId: string
}

export function DashboardClient({ boards: initialBoards, currentUserId }: DashboardClientProps) {
  const t = useTranslations('boards')
  const locale = useLocale()
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Локальная копия списка досок для оптимистичных обновлений.
  // Когда сервер присылает новые props (после revalidatePath/навигации),
  // синхронизируемся прямо во время рендера — рекомендованный React паттерн
  // вместо useEffect + setState (не вызывает каскадных ре-рендеров).
  const [boards, setBoards] = useState(initialBoards)
  const [prevInitial, setPrevInitial] = useState(initialBoards)
  if (initialBoards !== prevInitial) {
    setPrevInitial(initialBoards)
    setBoards(initialBoards)
  }

  function handleDelete(boardId: string) {
    if (!confirm(t('confirmDelete'))) return
    setBusyId(boardId)
    // Убираем доску из сетки мгновенно, не дожидаясь перезагрузки страницы.
    setBoards((prev) => prev.filter((b) => b.id !== boardId))
    startTransition(async () => {
      const result = await deleteBoard(boardId)
      setBusyId(null)
      // Откат, если сервер вернул ошибку.
      if (result?.error) setBoards(initialBoards)
    })
  }

  function handleLeave(boardId: string) {
    if (!confirm(t('confirmLeave'))) return
    setBusyId(boardId)
    setBoards((prev) => prev.filter((b) => b.id !== boardId))
    startTransition(async () => {
      const result = await leaveBoard(boardId)
      setBusyId(null)
      if (result?.error) setBoards(initialBoards)
    })
  }

  const memberCount = (board: Board) => {
    if (!board.board_members || board.board_members.length === 0) return 0
    return board.board_members[0].count
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {boards.length === 0
              ? t('emptyHint')
              : t('countHint', { count: boards.length })}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus size={16} className="mr-1.5" />
          {t('newBoard')}
        </Button>
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-brand-50 rounded-3xl p-6 mb-5">
            <LayoutDashboard className="text-brand-400 mx-auto" size={48} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('emptyTitle')}</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">
            {t('emptyBody')}
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} className="mr-1.5" />
            {t('createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => {
            // Цвет иконки детерминирован по id — у доски он всегда одинаковый.
            const color = getBoardColor(board.id)
            return (
            <div
              key={board.id}
              className="group relative bg-white rounded-2xl border border-gray-200 shadow-soft hover:border-brand-300 hover:shadow-card transition-all"
            >
              <Link href={`/board/${board.id}`} className="block p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('rounded-xl p-2.5 transition-colors', color.bg, color.hoverBg)}>
                    <LayoutDashboard className={cn('group-hover:text-white transition-colors', color.icon)} size={20} />
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2 group-hover:text-brand-700 transition-colors">
                  {board.title}
                </h3>
                <p className="text-xs text-gray-400 mb-4">{t('createdOn', { date: formatDate(board.created_at) })}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Users size={13} />
                  <span>
                    {t('membersCount', { count: memberCount(board) })}
                  </span>
                </div>
              </Link>

              {board.owner_id === currentUserId ? (
                <button
                  onClick={() => handleDelete(board.id)}
                  disabled={busyId === board.id || isPending}
                  title={t('deleteBoard')}
                  className="absolute top-4 right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <button
                  onClick={() => handleLeave(board.id)}
                  disabled={busyId === board.id || isPending}
                  title={t('leaveBoard')}
                  className="absolute top-4 right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
            )
          })}

          <button
            onClick={() => setShowCreate(true)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all p-6 min-h-[160px] text-gray-400 hover:text-brand-600"
          >
            <Plus size={24} className="mb-2" />
            <span className="text-sm font-medium">{t('addBoard')}</span>
          </button>
        </div>
      )}

      <CreateBoardDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
