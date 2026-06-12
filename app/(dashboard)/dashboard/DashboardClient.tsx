'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Users, LayoutDashboard } from 'lucide-react'
import { deleteBoard } from '@/actions/boards'
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
}

export function DashboardClient({ boards: initialBoards }: DashboardClientProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(boardId: string) {
    if (!confirm('Удалить доску? Это действие нельзя отменить.')) return
    setDeleting(boardId)
    startTransition(async () => {
      await deleteBoard(boardId)
      setDeleting(null)
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Мои доски</h1>
          <p className="text-gray-500 text-sm mt-1">
            {initialBoards.length === 0
              ? 'Создайте первую доску для совместной работы'
              : `${initialBoards.length} ${initialBoards.length === 1 ? 'доска' : 'досок'}`}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus size={16} className="mr-1.5" />
          Создать доску
        </Button>
      </div>

      {initialBoards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-indigo-50 rounded-2xl p-6 mb-5">
            <LayoutDashboard className="text-indigo-400 mx-auto" size={48} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Досок пока нет</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">
            Создайте первую доску, чтобы начать организовывать задачи
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
              className="group relative bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <Link href={`/board/${board.id}`} className="block p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-indigo-100 rounded-lg p-2.5">
                    <LayoutDashboard className="text-indigo-600" size={20} />
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2">
                  {board.title}
                </h3>
                <p className="text-xs text-gray-400 mb-4">{formatDate(board.created_at)}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Users size={13} />
                  <span>{memberCount(board)} участников</span>
                </div>
              </Link>

              <button
                onClick={() => handleDelete(board.id)}
                disabled={deleting === board.id || isPending}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <button
            onClick={() => setShowCreate(true)}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all p-6 min-h-[160px] text-gray-400 hover:text-indigo-600"
          >
            <Plus size={24} className="mb-2" />
            <span className="text-sm font-medium">Новая доска</span>
          </button>
        </div>
      )}

      <CreateBoardDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
