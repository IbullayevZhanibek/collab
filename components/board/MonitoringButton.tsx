'use client'

import { forwardRef, useEffect, useImperativeHandle, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Flag,
  Users,
  MessageSquare,
  Paperclip,
  BookOpen,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMonitoringData } from '@/actions/monitoring'
import type {
  MonitoringData,
  ProjectMetrics,
  StudentActivityMetric,
  TeamCollaborationMetrics,
  TaskDistItem,
  ActivityLevel,
} from '@/lib/types'

interface MonitoringButtonProps {
  boardId: string
}

const LEVEL_STYLE: Record<ActivityLevel, { dot: string; text: string; badge: string }> = {
  active:   { dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' },
  low:      { dot: 'bg-amber-400',   text: 'text-amber-700',   badge: 'bg-amber-50 text-amber-700' },
  inactive: { dot: 'bg-gray-300',    text: 'text-gray-500',    badge: 'bg-gray-100 text-gray-500' },
}

export interface MonitoringButtonHandle { open: () => void }

export const MonitoringButton = forwardRef<MonitoringButtonHandle, MonitoringButtonProps>(function MonitoringButton({ boardId }, ref) {
  const t  = useTranslations('monitoring')
  const tc = useTranslations('common')

  const [open, setOpen]     = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [data, setData]     = useState<MonitoringData | null>(null)
  const [err, setErr]       = useState<string | null>(null)
  const [isPending, startLoad] = useTransition()

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), [])

  function reload() {
    setErr(null)
    startLoad(async () => {
      const res = await getMonitoringData(boardId)
      if (res.error) { setErr(res.error); return }
      setData(res.data)
      setLoaded(true)
    })
  }

  useEffect(() => {
    if (open && !loaded) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-2 sm:px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
      >
        <BarChart3 size={16} className="shrink-0" />
        <span className="hidden sm:inline">{t('title')}</span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-overlay-in"
              onClick={() => setOpen(false)}
            />

            <aside className="absolute inset-y-0 right-0 w-full sm:w-[700px] sm:max-w-[90vw] bg-white shadow-pop flex flex-col animate-drawer-in">
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-brand-600" />
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('title')}</h2>
                </div>
                <div className="flex items-center gap-1">
                  {loaded && (
                    <button
                      onClick={reload}
                      disabled={isPending}
                      title={t('refresh')}
                      className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={15} className={isPending ? 'animate-spin' : ''} />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    aria-label={tc('close')}
                    className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin">
                {isPending && !loaded ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                  </div>
                ) : err ? (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                    {err}
                  </div>
                ) : data ? (
                  <MonitoringContent data={data} />
                ) : null}
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  )
})

// ── Основной контент ────────────────────────────────────────────────────────
function MonitoringContent({ data }: { data: MonitoringData }) {
  const { project, students, collaboration } = data

  return (
    <div className="space-y-7">
      <ProjectSection project={project} />
      <StudentSection students={students} />
      <DistributionSection distribution={collaboration.taskDistribution} />
      <CollaborationSection collab={collaboration} />
    </div>
  )
}

// ── Обзор проекта ───────────────────────────────────────────────────────────
function ProjectSection({ project }: { project: ProjectMetrics }) {
  const t = useTranslations('monitoring')

  const noDeadlines = project.cardsWithDeadline === 0
  const noCards     = project.totalCards === 0

  return (
    <section>
      <SectionTitle>{t('projectOverview')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {/* Выполнение задач */}
        <MetricCard
          icon={<CheckCircle2 size={17} className={noCards ? 'text-gray-300' : 'text-emerald-500'} />}
          label={t('completionRate')}
          value={noCards ? '—' : `${project.completionRate}%`}
          sub={noCards ? t('noTasks') : t('cardsOf', { done: project.doneCards, total: project.totalCards })}
          progress={noCards ? 0 : project.completionRate}
          barColor="bg-emerald-500"
        />

        {/* Соблюдение сроков */}
        <MetricCard
          icon={<Clock size={17} className={noDeadlines ? 'text-gray-300' : 'text-blue-500'} />}
          label={t('deadlineCompliance')}
          value={noDeadlines ? '—' : `${project.deadlineCompliance}%`}
          sub={noDeadlines ? t('noDeadlines') : t('cardsOf', { done: project.onTimeCards, total: project.cardsWithDeadline })}
          progress={noDeadlines ? 0 : project.deadlineCompliance}
          barColor="bg-blue-500"
        />

        {/* Просрочено */}
        <MetricCard
          icon={
            <AlertTriangle
              size={17}
              className={project.overdueCount > 0 ? 'text-red-500' : 'text-gray-300'}
            />
          }
          label={t('overdue')}
          value={String(project.overdueCount)}
          sub={t('overdueHint')}
          accent={project.overdueCount > 0 ? 'red' : undefined}
        />

        {/* Прогресс этапов */}
        <MetricCard
          icon={<Flag size={17} className={project.totalStages === 0 ? 'text-gray-300' : 'text-brand-500'} />}
          label={t('stageProgress')}
          value={project.totalStages === 0 ? '—' : `${project.stageProgress}%`}
          sub={project.totalStages === 0 ? t('noStages') : t('stagesOf', { done: project.doneStages, total: project.totalStages })}
          progress={project.totalStages === 0 ? 0 : project.stageProgress}
          barColor="bg-brand-500"
        />
      </div>
    </section>
  )
}

// ── Активность студентов ─────────────────────────────────────────────────────
function StudentSection({ students }: { students: StudentActivityMetric[] }) {
  const t = useTranslations('monitoring')

  if (students.length === 0) {
    return (
      <section>
        <SectionTitle>{t('studentActivity')}</SectionTitle>
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-gray-100 bg-gray-50">
          <Users size={32} className="text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">{t('noStudents')}</p>
        </div>
      </section>
    )
  }

  const sorted = [...students].sort((a, b) => b.activityScore - a.activityScore)

  return (
    <section>
      <SectionTitle>{t('studentActivity')}</SectionTitle>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[
                  { key: 'student',    align: 'left'   },
                  { key: 'tasksDone',  align: 'center' },
                  { key: 'comments',   align: 'center' },
                  { key: 'links',      align: 'center' },
                  { key: 'reflections',align: 'center' },
                  { key: 'activityIndex', align: 'left' },
                ].map(({ key, align }) => (
                  <th
                    key={key}
                    className={cn(
                      'text-xs font-semibold text-gray-500 px-3 py-2.5 whitespace-nowrap',
                      align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {t(key as Parameters<typeof t>[0])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((s) => (
                <StudentRow key={s.userId} student={s} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-4 mt-2 px-1">
        {(['active', 'low', 'inactive'] as ActivityLevel[]).map((lvl) => (
          <span key={lvl} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={cn('w-2 h-2 rounded-full', LEVEL_STYLE[lvl].dot)} />
            {t(lvl === 'active' ? 'active' : lvl === 'low' ? 'lowActivity' : 'inactive')}
            {lvl === 'active' ? ' (≥15)' : lvl === 'low' ? ' (5–14)' : ' (<5)'}
          </span>
        ))}
      </div>
    </section>
  )
}

function StudentRow({ student }: { student: StudentActivityMetric }) {
  const t    = useTranslations('monitoring')
  const lvl  = LEVEL_STYLE[student.activityLevel]
  const name = student.fullName ?? student.email.split('@')[0]

  const levelLabel =
    student.activityLevel === 'active'   ? t('active')
    : student.activityLevel === 'low'    ? t('lowActivity')
    :                                      t('inactive')

  const maxScore = 99 // normalization cap for the inline bar

  return (
    <tr className="hover:bg-gray-50/60 transition-colors">
      {/* Имя */}
      <td className="px-3 py-2.5">
        <p className="font-medium text-gray-900 truncate max-w-[130px]">{name}</p>
        {student.teamRole && (
          <p className="text-[11px] text-gray-400 capitalize">
            {student.teamRole.replace(/_/g, ' ')}
          </p>
        )}
      </td>

      {/* Задачи выполнено/назначено */}
      <td className="px-2 py-2.5 text-center">
        <span className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{student.doneCards}</span>
          <span className="text-gray-400">/{student.assignedCards}</span>
        </span>
      </td>

      <td className="px-2 py-2.5 text-center text-sm text-gray-700">
        {student.commentsCount}
      </td>
      <td className="px-2 py-2.5 text-center text-sm text-gray-700">
        {student.linksCount}
      </td>
      <td className="px-2 py-2.5 text-center text-sm text-gray-700">
        {student.reflectionsCount}
      </td>

      {/* Индекс + бейдж */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full', lvl.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', lvl.dot)} />
            {levelLabel}
          </span>
          <span className="text-xs text-gray-400 font-mono tabular-nums">
            {student.activityScore}
          </span>
        </div>
        {/* Мини-бар активности */}
        <div className="mt-1.5 h-1 w-24 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', lvl.dot)}
            style={{ width: `${Math.min((student.activityScore / maxScore) * 100, 100)}%` }}
          />
        </div>
      </td>
    </tr>
  )
}

// ── Распределение задач ──────────────────────────────────────────────────────
function DistributionSection({ distribution }: { distribution: TaskDistItem[] }) {
  const t = useTranslations('monitoring')

  if (distribution.length === 0) return null

  const maxAssigned = Math.max(...distribution.map((d) => d.assigned), 1)

  return (
    <section>
      <SectionTitle>{t('taskDistribution')}</SectionTitle>
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        {distribution.map(({ name, assigned, done }) => (
          <div key={name} className="flex items-center gap-3">
            {/* Имя */}
            <span className="text-sm text-gray-600 w-20 shrink-0 truncate">{name}</span>

            {/* Бары */}
            <div className="flex-1 space-y-1">
              {/* Назначено */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 rounded-full bg-indigo-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-300 transition-all"
                    style={{ width: `${(assigned / maxAssigned) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-4 text-right tabular-nums">{assigned}</span>
              </div>
              {/* Выполнено */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 rounded-full bg-indigo-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${(done / maxAssigned) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-4 text-right tabular-nums">{done}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Легенда */}
        <div className="flex items-center gap-5 pt-1">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-indigo-300 inline-block" />
            {t('assigned')}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-indigo-600 inline-block" />
            {t('done')}
          </span>
        </div>
      </div>
    </section>
  )
}

// ── Командное взаимодействие ─────────────────────────────────────────────────
function CollaborationSection({ collab }: { collab: TeamCollaborationMetrics }) {
  const t = useTranslations('monitoring')

  const engagementPct =
    collab.totalStudents > 0
      ? Math.round((collab.activeStudents / collab.totalStudents) * 100)
      : 0

  return (
    <section>
      <SectionTitle>{t('collaboration')}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <CollabTile
          icon={<MessageSquare size={16} className="text-brand-500" />}
          value={collab.totalComments}
          label={t('totalComments')}
        />
        <CollabTile
          icon={<Paperclip size={16} className="text-brand-500" />}
          value={collab.totalLinks}
          label={t('totalLinks')}
        />
        <CollabTile
          icon={<BookOpen size={16} className="text-brand-500" />}
          value={collab.totalStudents > 0
            ? `${collab.activeStudents}/${collab.totalStudents}`
            : '—'}
          label={t('activeStudents')}
        />
      </div>

      {/* Вовлечённость */}
      {collab.totalStudents > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">{t('engagementRate')}</span>
            <span className="text-sm font-semibold text-gray-900">{engagementPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                engagementPct >= 75 ? 'bg-emerald-500' :
                engagementPct >= 40 ? 'bg-amber-400' :
                'bg-brand-500',
              )}
              style={{ width: `${engagementPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {t('engagementHint', {
              active: collab.activeStudents,
              total: collab.totalStudents,
            })}
          </p>
        </div>
      )}
    </section>
  )
}

// ── Вспомогательные компоненты ───────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
      {children}
    </h3>
  )
}

function MetricCard({
  icon, label, value, sub, progress, barColor, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  progress?: number
  barColor?: string
  accent?: 'red'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        accent === 'red' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200',
      )}
    >
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <span className="text-xs font-medium text-gray-500 leading-tight">{label}</span>
      </div>
      <p
        className={cn(
          'text-3xl font-bold tracking-tight',
          accent === 'red' ? 'text-red-600' : 'text-gray-900',
        )}
      >
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function CollabTile({
  icon, value, label,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-center">
      <div className="flex justify-center mb-1.5">{icon}</div>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}
