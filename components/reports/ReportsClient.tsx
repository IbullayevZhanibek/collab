'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Download, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getProjectReport } from '@/actions/reports'
import type {
  TeacherOverviewItem,
  ProjectReportData,
  StudentReportData,
  StudentReflection,
} from '@/lib/types'

// ── CSV helpers ──────────────────────────────────────────────────────────

function esc(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Sub-components ───────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col gap-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function BarRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

function ComparisonChart({
  overview,
  t,
}: {
  overview: TeacherOverviewItem[]
  t: ReturnType<typeof useTranslations<'reports'>>
}) {
  if (!overview.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('chartTitle')}</h3>
      <div className="space-y-4">
        {overview.map((item) => (
          <div key={item.boardId}>
            <p className="text-sm text-gray-800 font-medium mb-1.5 truncate">{item.boardTitle}</p>
            <BarRow label={t('chartCompletion')} pct={item.completionRate} color="bg-emerald-500" />
            <BarRow label={t('chartStages')} pct={item.stageProgress} color="bg-brand-400" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-full bg-emerald-500" />{t('chartCompletion')}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-full bg-brand-400" />{t('chartStages')}</span>
      </div>
    </div>
  )
}

function StatusBadge({ isActive, t }: { isActive: boolean; t: ReturnType<typeof useTranslations<'reports'>> }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
    )}>
      {isActive ? t('statusActive') : t('statusCompleted')}
    </span>
  )
}

function LevelBadge({ level }: { level: 'active' | 'low' | 'inactive' }) {
  const styles = {
    active:   'bg-emerald-50 text-emerald-700',
    low:      'bg-amber-50 text-amber-700',
    inactive: 'bg-gray-100 text-gray-500',
  }
  const labels = { active: '●', low: '◕', inactive: '○' }
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold', styles[level])}>
      {labels[level]}
    </span>
  )
}

function StudentDetail({
  student,
  reflections,
  t,
}: {
  student: StudentReportData
  reflections: StudentReflection[]
  t: ReturnType<typeof useTranslations<'reports'>>
}) {
  const taskPct = student.assignedCards > 0 ? Math.round((student.doneCards / student.assignedCards) * 100) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Tasks */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('detailTasks')}</p>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-2xl font-bold text-gray-900">{student.doneCards}</span>
          <span className="text-sm text-gray-400 mb-0.5">/ {student.assignedCards}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 mb-1">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${taskPct}%` }} />
        </div>
        <p className="text-xs text-gray-400">{taskPct}%</p>
      </div>

      {/* Grade */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('detailGrade')}</p>
        {student.gradeScore != null ? (
          <>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-900">{student.gradeScore}</span>
              <span className="text-sm text-gray-400 mb-0.5">/ {student.gradeMax}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 mb-1">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${student.gradePercent}%` }} />
            </div>
            <p className="text-xs text-gray-400">{student.gradePercent}%</p>
          </>
        ) : (
          <p className="text-sm text-gray-400 mt-2">{t('noGrade')}</p>
        )}
      </div>

      {/* Reflections */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('detailReflections')}</p>
        {reflections.length === 0 ? (
          <p className="text-sm text-gray-400">{t('detailNoReflections')}</p>
        ) : (
          <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
            {reflections.map((r, i) => (
              <div key={i} className="text-xs">
                <p className="font-semibold text-gray-700 mb-1">
                  {r.stageTitle ?? t('reflGeneral')}
                </p>
                {r.whatDone && (
                  <p className="text-gray-600"><span className="text-gray-400">{t('reflWhatDone')}: </span>{r.whatDone}</p>
                )}
                {r.difficulties && (
                  <p className="text-gray-600"><span className="text-gray-400">{t('reflDifficulties')}: </span>{r.difficulties}</p>
                )}
                {r.improvements && (
                  <p className="text-gray-600"><span className="text-gray-400">{t('reflImprovements')}: </span>{r.improvements}</p>
                )}
                {r.contribution && (
                  <p className="text-gray-600"><span className="text-gray-400">{t('reflContribution')}: </span>{r.contribution}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────

export function ReportsClient({ overview }: { overview: TeacherOverviewItem[] }) {
  const t = useTranslations('reports')
  const [activeTab,          setActiveTab]          = useState<'projects' | 'students'>('projects')
  const [selectedBoardId,    setSelectedBoardId]    = useState<string>(overview[0]?.boardId ?? '')
  const [projectReport,      setProjectReport]      = useState<ProjectReportData | null>(null)
  const [expandedStudentId,  setExpandedStudentId]  = useState<string | null>(null)
  const [isPending,          startTransition]       = useTransition()

  function loadProjectReport(boardId: string) {
    setExpandedStudentId(null)
    setProjectReport(null)
    startTransition(async () => {
      const { data } = await getProjectReport(boardId)
      setProjectReport(data)
    })
  }

  function handleTabChange(tab: 'projects' | 'students') {
    setActiveTab(tab)
    if (tab === 'students' && !projectReport && selectedBoardId) {
      loadProjectReport(selectedBoardId)
    }
  }

  function handleBoardChange(boardId: string) {
    setSelectedBoardId(boardId)
    loadProjectReport(boardId)
  }

  function toggleStudent(id: string) {
    setExpandedStudentId((prev) => (prev === id ? null : id))
  }

  // ── Summary stats ──────────────────────────────────────────────────────

  const totalStudents   = overview.reduce((s, o) => s + o.studentCount, 0)
  const avgCompletion   = overview.length
    ? Math.round(overview.reduce((s, o) => s + o.completionRate, 0) / overview.length)
    : 0
  const scoredProjects  = overview.filter((o) => o.avgScore !== null)
  const avgScore        = scoredProjects.length
    ? Math.round(scoredProjects.reduce((s, o) => s + (o.avgScore ?? 0), 0) / scoredProjects.length)
    : null

  // ── CSV helpers ────────────────────────────────────────────────────────

  function exportProjectsCsv() {
    const headers = [
      t('colProject'), t('colStudents'), t('colCompletion'), t('colStages'), t('colScore'), 'Status',
    ]
    const rows = overview.map((o) => [
      o.boardTitle,
      o.studentCount,
      `${o.completionRate}%`,
      `${o.stageProgress}%`,
      o.avgScore != null ? `${o.avgScore}%` : '',
      o.isActive ? t('statusActive') : t('statusCompleted'),
    ])
    downloadCsv([headers, ...rows] as string[][], 'projects-report.csv')
  }

  function exportStudentsCsv() {
    if (!projectReport) return
    const headers = [
      t('colStudent'), 'Email', t('colRole'),
      t('colAssigned'), t('colDone'),
      t('colComments'), t('colLinks'), t('colReflections'),
      t('colActivity'), t('colGrade'),
    ]
    const rows = projectReport.students.map((s) => [
      s.fullName ?? s.email,
      s.email,
      s.teamRole ?? '',
      s.assignedCards,
      s.doneCards,
      s.commentsCount,
      s.linksCount,
      s.reflectionsCount,
      s.activityScore,
      s.gradePercent != null ? `${s.gradePercent}%` : '',
    ])
    downloadCsv([headers, ...rows] as string[][], `${projectReport.boardTitle}-students.csv`)
  }

  // ── Tab button ─────────────────────────────────────────────────────────

  const tabBtn = (tab: 'projects' | 'students', label: string) => (
    <button
      onClick={() => handleTabChange(tab)}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
        activeTab === tab
          ? 'bg-brand-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100',
      )}
    >
      {label}
    </button>
  )

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard label={t('summaryProjects')}      value={overview.length} />
        <SummaryCard label={t('summaryStudents')}      value={totalStudents} />
        <SummaryCard label={t('summaryAvgCompletion')} value={`${avgCompletion}%`} />
        <SummaryCard label={t('summaryAvgScore')}      value={avgScore != null ? `${avgScore}%` : '—'} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        {tabBtn('projects', t('tabProjects'))}
        {tabBtn('students', t('tabStudents'))}
      </div>

      {/* ── By Projects tab ─────────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <ComparisonChart overview={overview} t={t} />

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">{t('tabProjects')}</h3>
              <button
                onClick={exportProjectsCsv}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Download size={13} />
                {t('exportCsv')}
              </button>
            </div>

            {overview.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-10 text-center">{t('noProjects')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="px-5 py-3 font-medium">{t('colProject')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('colStudents')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('colCompletion')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('colStages')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('colScore')}</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {overview.map((item) => (
                      <tr key={item.boardId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[200px] truncate">{item.boardTitle}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600 tabular-nums">{item.studentCount}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className={cn(
                            'font-medium',
                            item.completionRate >= 75 ? 'text-emerald-600' :
                            item.completionRate >= 40 ? 'text-amber-600' : 'text-red-500',
                          )}>
                            {item.completionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-gray-600 tabular-nums">{item.stageProgress}%</td>
                        <td className="px-4 py-3.5 text-right text-gray-600 tabular-nums">
                          {item.avgScore != null ? `${item.avgScore}%` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge isActive={item.isActive} t={t} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── By Students tab ─────────────────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {/* Project selector */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium text-gray-700 shrink-0">{t('colProject')}:</label>
            <select
              value={selectedBoardId}
              onChange={(e) => handleBoardChange(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {overview.length === 0 && (
                <option value="">{t('noProjects')}</option>
              )}
              {overview.map((o) => (
                <option key={o.boardId} value={o.boardId}>{o.boardTitle}</option>
              ))}
            </select>

            {isPending && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" />
                {t('loading')}
              </span>
            )}

            {projectReport && !isPending && (
              <button
                onClick={exportStudentsCsv}
                className="ml-auto flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Download size={13} />
                {t('exportCsv')}
              </button>
            )}
          </div>

          {/* Students table */}
          {projectReport && !isPending && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {projectReport.students.length === 0 ? (
                <p className="text-sm text-gray-400 px-5 py-10 text-center">{t('noStudents')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="px-5 py-3 font-medium">{t('colStudent')}</th>
                        <th className="px-4 py-3 font-medium">{t('colRole')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('colAssigned')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('colDone')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('colComments')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('colLinks')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('colReflections')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('colActivity')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('colGrade')}</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectReport.students.map((s) => {
                        const isExpanded = expandedStudentId === s.userId
                        const studentReflections = projectReport.reflections.filter((r) => r.studentId === s.userId)
                        return (
                          <>
                            <tr
                              key={s.userId}
                              onClick={() => toggleStudent(s.userId)}
                              className={cn(
                                'border-b border-gray-50 cursor-pointer transition-colors',
                                isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50',
                              )}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <LevelBadge level={s.activityLevel} />
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 truncate max-w-[140px]">
                                      {s.fullName ?? s.email.split('@')[0]}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate max-w-[140px]">{s.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{s.teamRole ?? <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-700">{s.assignedCards}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className={cn('font-medium', s.doneCards === s.assignedCards && s.assignedCards > 0 ? 'text-emerald-600' : 'text-gray-700')}>
                                  {s.doneCards}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{s.commentsCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{s.linksCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{s.reflectionsCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">{s.activityScore}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                {s.gradePercent != null ? `${s.gradePercent}%` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-gray-400">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr key={`${s.userId}-detail`}>
                                <td colSpan={10} className="p-4 bg-gray-50 border-b border-gray-100">
                                  <StudentDetail student={s} reflections={studentReflections} t={t} />
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {isPending && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
