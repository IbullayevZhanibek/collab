'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, LogOut, Users, LayoutDashboard } from 'lucide-react'
import { deleteBoard } from '@/actions/boards'
import { leaveBoard } from '@/actions/members'
import { CreateBoardDialog } from '@/components/dashboard/CreateBoardDialog'
import { Button } from '@/components/ui/button'

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

function pluralizeBoards(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'доска'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'доски'
  return 'досок'
}

function pluralizeMembers(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'участник'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'участника'
  return 'участников'
}

export function DashboardClient({ boards: initialBoards, currentUserId }: DashboardClientProps) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(boardId: string) {
    if (!confirm('Удалить доску? Это действие нельзя отменить.')) return
    setBusyId(boardId)
    startTransition(async () => {
      await deleteBoard(boardId)
      setBusyId(null)
      router.refresh()
    })
  }

  function handleLeave(boardId: string) {
    if (!confirm('Вы уверены, что хотите покинуть доску?')) return
    setBusyId(boardId)
    startTransition(async () => {
      await leaveBoard(boardId)
      setBusyId(null)
      router.refresh()
    })
  }

  const memberCount = (board: Board) => {
    if (!board.board_members || board.board_members.length === 0) return 0
    return board.board_members[0].count
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Доски</h1>
          <p className="text-gray-500 text-sm mt-1">
            {initialBoards.length === 0
              ? 'Здесь будут жить ваши проекты'
              : `${initialBoards.length} ${pluralizeBoards(initialBoards.length)} · нажмите, чтобы открыть`}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus size={16} className="mr-1.5" />
          Новая доска
        </Button>
      </div>

      {initialBoards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-brand-50 rounded-3xl p-6 mb-5">
            <LayoutDashboard className="text-brand-400 mx-auto" size={48} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">С чего начнём?</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">
            Создайте первую доску — например, для курсового проекта или командной работы. Это займёт пару секунд.
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} className="mr-1.5" />
            Создать первую доску
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialBoards.map((board) => (
            <div
              key={board.id}
              className="group relative bg-white rounded-2xl border border-gray-200 shadow-soft hover:border-brand-300 hover:shadow-card transition-all"
            >
              <Link href={`/board/${board.id}`} className="block p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-brand-100 rounded-xl p-2.5 group-hover:bg-brand-600 transition-colors">
                    <LayoutDashboard className="text-brand-600 group-hover:text-white transition-colors" size={20} />
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2 group-hover:text-brand-700 transition-colors">
                  {board.title}
                </h3>
                <p className="text-xs text-gray-400 mb-4">Создана {formatDate(board.created_at)}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Users size={13} />
                  <span>
                    {memberCount(board)} {pluralizeMembers(memberCount(board))}
                  </span>
                </div>
              </Link>

              {board.owner_id === currentUserId ? (
                <button
                  onClick={() => handleDelete(board.id)}
                  disabled={busyId === board.id || isPending}
                  title="Удалить доску"
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <button
                  onClick={() => handleLeave(board.id)}
                  disabled={busyId === board.id || isPending}
                  title="Покинуть доску"
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() => setShowCreate(true)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all p-6 min-h-[160px] text-gray-400 hover:text-brand-600"
          >
            <Plus size={24} className="mb-2" />
            <span className="text-sm font-medium">Добавить доску</span>
          </button>
        </div>
      )}

      <CreateBoardDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
