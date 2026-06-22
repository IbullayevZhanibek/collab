'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  Plus, Trash2, Users, LayoutDashboard,
  AlertTriangle, TrendingUp, BookOpen, CheckCircle2,
} from 'lucide-react'
import { deleteBoard } from '@/actions/boards'
import { CreateBoardDialog } from '@/components/dashboard/CreateBoardDialog'
import { Button } from '@/components/ui/button'
import { cn, getBoardColor, formatDate, formatDateShort } from '@/lib/utils'
import type { TeacherDashboardData } from '@/lib/types'

interface Props {
  data: TeacherDashboardData
  currentUserId: string
}

export function TeacherDashboardClient({ data: initial, currentUserId: _currentUserId }: Props) {
  const t = useTranslations('dashboard')
  const tb = useTranslations('boards')
  const tboard = useTranslations('board')
  const locale = useLocale()

  const [data, setData] = useState(initial)
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setData(initial)
  }

  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDelete(boardId: string) {
    if (!confirm(tb('confirmDelete'))) return
    setBusyId(boardId)
    const isActive = data.projects.find((p) => p.id === boardId)?.status === 'active'
    setData((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== boardId),
      activeProjects: isActive ? Math.max(0, prev.activeProjects - 1) : prev.activeProjects,
    }))
    startTransition(async () => {
      const result = await deleteBoard(boardId)
      setBusyId(null)
      if (result?.error) setData(initial)
    })
  }

  const activeProjects = data.projects.filter((p) => p.status === 'active')
  const completedProjects = data.projects.filter((p) => p.status === 'completed')

  const stats = [
    {
      label: t('activeProjects'),
      value: data.activeProjects,
      Icon: LayoutDashboard,
      wrap: 'bg-brand-100 text-brand-600',
      valueClass: undefined as string | undefined,
    },
    {
      label: t('totalStudents'),
      value: data.totalStudents,
      Icon: Users,
      wrap: 'bg-violet-100 text-violet-600',
      valueClass: undefined as string | undefined,
    },
    {
      label: t('avgProgress'),
      value: `${data.avgProgress}%`,
      Icon: TrendingUp,
      wrap: 'bg-emerald-100 text-emerald-600',
      valueClass: undefined as string | undefined,
    },
    {
      label: t('needsAttentionLabel'),
      value: data.needsAttentionCount,
      Icon: AlertTriangle,
      wrap: data.needsAttentionCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400',
      valueClass: data.needsAttentionCount > 0 ? 'text-red-600' : undefined,
    },
  ]

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, Icon, wrap, valueClass }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4 sm:p-5">
            <div className={cn('inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3', wrap)}>
              <Icon size={18} />
            </div>
            <p className={cn('text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums leading-none', valueClass)}>
              {value}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Needs attention */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">{t('needsAttention')}</h2>
        {data.attentionSignals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-soft px-4 py-4 flex items-center gap-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 text-sm shrink-0">
              ✓
            </span>
            <p className="text-sm font-medium text-gray-700">{t('allGood')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.attentionSignals.map((sig, i) => {
              const isCompleted = sig.type === 'completed_ungraded'
              return (
                <Link
                  key={`${sig.boardId}-${sig.type}-${i}`}
                  href={`/board/${sig.boardId}`}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors',
                    sig.type === 'overdue'
                      ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100/70'
                      : isCompleted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                      : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70',
                  )}
                >
                  <span className="text-sm font-medium line-clamp-2 sm:line-clamp-none sm:truncate">
                    {sig.type === 'overdue'
                      ? t('signalOverdue', { count: sig.count, project: sig.boardTitle })
                      : sig.type === 'completed_ungraded'
                      ? t('signalCompletedUngraded', { count: sig.count, project: sig.boardTitle })
                      : t('signalLowActivity', { count: sig.count, project: sig.boardTitle })}
                  </span>
                  <span className="text-xs opacity-70 shrink-0 hidden sm:inline">{sig.boardTitle}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Active projects */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{tb('titleTeacher')}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {data.projects.length === 0
                ? tb('emptyHintTeacher')
                : tb('countHint', { count: data.projects.length })}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
            <Plus size={16} className="mr-1.5" />
            {tb('newProject')}
          </Button>
        </div>

        {data.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-brand-50 rounded-3xl p-6 mb-5">
              <BookOpen className="text-brand-400 mx-auto" size={48} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{tb('emptyTitle')}</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-xs">{tb('emptyBody')}</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1.5" />
              {tb('createFirst')}
            </Button>
          </div>
        ) : (
          <>
            {/* Active projects grid */}
            {activeProjects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    locale={locale}
                    busyId={busyId}
                    onDelete={handleDelete}
                    t={t}
                    tb={tb}
                  />
                ))}
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all p-6 min-h-[160px] text-gray-400 hover:text-brand-600"
                >
                  <Plus size={24} className="mb-2" />
                  <span className="text-sm font-medium">{tb('addProject')}</span>
                </button>
              </div>
            )}

            {/* Completed projects section */}
            {completedProjects.length > 0 && (
              <div className={activeProjects.length > 0 ? 'mt-8' : undefined}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {tboard('completed')} · {completedProjects.length}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      locale={locale}
                      busyId={busyId}
                      onDelete={handleDelete}
                      t={t}
                      tb={tb}
                      completedAt={project.completed_at}
                      tboard={tboard}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Add button when only completed projects exist */}
            {activeProjects.length === 0 && completedProjects.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all p-6 w-full text-gray-400 hover:text-brand-600"
                >
                  <Plus size={24} className="mb-2" />
                  <span className="text-sm font-medium">{tb('addProject')}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <CreateBoardDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}

function ProjectCard({
  project,
  locale,
  busyId,
  onDelete,
  t,
  tb,
  completedAt,
  tboard,
}: {
  project: {
    id: string
    title: string
    created_at: string
    studentCount: number
    completionRate: number
    overdueCount: number
    status: 'active' | 'completed'
  }
  locale: string
  busyId: string | null
  onDelete: (id: string) => void
  t: ReturnType<typeof useTranslations<'dashboard'>>
  tb: ReturnType<typeof useTranslations<'boards'>>
  completedAt?: string | null
  tboard?: ReturnType<typeof useTranslations<'board'>>
}) {
  const color = getBoardColor(project.id)
  const isCompleted = project.status === 'completed'

  return (
    <div
      className={cn(
        'group relative bg-white rounded-2xl border shadow-soft hover:shadow-card transition-all',
        isCompleted
          ? 'border-gray-200 opacity-80 hover:opacity-100 hover:border-emerald-200'
          : 'border-gray-200 hover:border-brand-300',
      )}
    >
      <Link href={`/board/${project.id}`} className="block p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('rounded-xl p-2.5 transition-colors', color.bg, color.hoverBg)}>
            <LayoutDashboard
              className={cn('group-hover:text-white transition-colors', color.icon)}
              size={20}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {isCompleted ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                <CheckCircle2 size={10} />
                {tboard?.('completed')}
              </span>
            ) : project.overdueCount > 0 ? (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 border border-red-100 px-2 py-0.5 rounded-full shrink-0">
                <AlertTriangle size={10} />
                {t('overdueShort')}
              </span>
            ) : null}
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2 group-hover:text-brand-700 transition-colors">
          {project.title}
        </h3>

        {completedAt && tboard ? (
          <p className="text-xs text-emerald-600 mb-4">
            {tboard('completedAt', { date: formatDateShort(completedAt, locale) })}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            {tb('createdOn', { date: formatDate(project.created_at, locale) })}
          </p>
        )}

        {/* Мини-метрики: студенты + прогресс */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
            <Users size={12} />
            <span>{project.studentCount}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isCompleted
                    ? 'bg-emerald-400'
                    : project.completionRate >= 75
                    ? 'bg-emerald-500'
                    : project.completionRate >= 40
                    ? 'bg-amber-400'
                    : 'bg-gray-300',
                )}
                style={{ width: `${project.completionRate}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums shrink-0">{project.completionRate}%</span>
          </div>
        </div>
      </Link>

      <button
        onClick={() => onDelete(project.id)}
        disabled={busyId === project.id}
        title={tb('deleteBoard')}
        className="action-btn absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
