'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  BookText,
  Download,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProjectGradebook, setFinalGrade } from '@/actions/gradebook'
import type { ProjectGradebookData, GradebookStudentEntry, RubricCriterion } from '@/lib/types'

// ── CSV ─────────────────────────────────────────────────────────────────────

function esc(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

function downloadCsv(rows: (string | number | null | undefined)[][], filename: string) {
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }

function entryKey(e: GradebookStudentEntry) { return e.studentId ?? '__project__' }

function scoreColor(percent: number | null): string {
  if (percent === null) return 'bg-gray-100 text-gray-400'
  if (percent >= 75)    return 'bg-emerald-100 text-emerald-800'
  if (percent >= 50)    return 'bg-amber-100   text-amber-800'
  return 'bg-red-100 text-red-800'
}

function displayPct(entry: GradebookStudentEntry): number | null {
  if (entry.hasFinalGrade && entry.finalScore !== null)
    return pct(entry.finalScore, entry.finalMax)
  if (entry.criteriaScores.some((cs) => cs.score !== null))
    return entry.rubricPercent
  return null
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col gap-0.5 min-w-[110px]">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Score chip (read-only) ────────────────────────────────────────────────────

function ScoreChip({ score, max, colored }: { score: number | null; max: number; colored?: boolean }) {
  if (score === null) return <span className="text-gray-300 text-sm">—</span>
  const p = pct(score, max)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
      colored ? scoreColor(p) : 'bg-gray-50 text-gray-700'
    )}>
      {score}
      <span className="font-normal opacity-60">/{max}</span>
    </span>
  )
}

// ── Inline grade editor ───────────────────────────────────────────────────────

interface GradeCellProps {
  entry: GradebookStudentEntry
  onSave: (studentId: string | null, score: number, maxScore: number) => Promise<void>
  saving: boolean
}

function GradeCell({ entry, onSave, saving }: GradeCellProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const [maxVal, setMaxVal]   = useState('')

  const key = entryKey(entry)
  const dp  = displayPct(entry)

  function startEdit() {
    const curScore = entry.hasFinalGrade ? entry.finalScore : entry.rubricTotal
    const curMax   = entry.hasFinalGrade ? entry.finalMax   : entry.rubricMax || 100
    setVal(curScore != null ? String(curScore) : '')
    setMaxVal(String(curMax))
    setEditing(true)
  }

  function cancel() { setEditing(false) }

  async function confirm() {
    const s = parseFloat(val)
    const m = parseFloat(maxVal) || 100
    if (!Number.isFinite(s) || s < 0) { cancel(); return }
    setEditing(false)
    await onSave(entry.studentId, s, m)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  confirm()
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[130px]" onClick={(e) => e.stopPropagation()}>
        <input
          type="number" min={0} max={maxVal || 100} step="0.5"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-16 h-7 px-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          autoFocus
        />
        <span className="text-gray-400 text-xs">/</span>
        <input
          type="number" min={1} step={1}
          value={maxVal}
          onChange={(e) => setMaxVal(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-14 h-7 px-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button onClick={confirm} className="p-1 rounded text-emerald-600 hover:bg-emerald-50">
          <Check size={14} />
        </button>
        <button onClick={cancel} className="p-1 rounded text-gray-400 hover:bg-gray-100">
          <X size={14} />
        </button>
      </div>
    )
  }

  const showScore = entry.hasFinalGrade && entry.finalScore !== null
    ? entry.finalScore
    : entry.criteriaScores.some((cs) => cs.score !== null) ? entry.rubricTotal : null

  const showMax = entry.hasFinalGrade ? entry.finalMax : (entry.rubricMax || 100)

  return (
    <button
      key={key}
      onClick={startEdit}
      disabled={saving}
      className={cn(
        'group flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors',
        'hover:ring-1 hover:ring-brand-300',
        scoreColor(dp),
      )}
    >
      {saving ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <>
          <span className="text-sm font-semibold tabular-nums">
            {showScore !== null ? showScore : '—'}
          </span>
          {showScore !== null && (
            <span className="text-xs font-normal opacity-60">/{showMax}</span>
          )}
          {entry.hasFinalGrade && (
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">★</span>
          )}
          <Pencil size={11} className="opacity-0 group-hover:opacity-60 shrink-0 ml-0.5" />
        </>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface GradebookClientProps {
  boards: { id: string; title: string }[]
  initialGradebook: ProjectGradebookData | null
}

export function GradebookClient({ boards, initialGradebook }: GradebookClientProps) {
  const t  = useTranslations('gradebook')
  const tc = useTranslations('common')

  const [gradebook, setGradebook]         = useState<ProjectGradebookData | null>(initialGradebook)
  const [selectedId, setSelectedId]       = useState(initialGradebook?.boardId ?? boards[0]?.id ?? '')
  const [isPending, startTransition]      = useTransition()
  const [savingId,  setSavingId]          = useState<string | null>(null)

  // ── Project switch ──

  function handleBoardChange(boardId: string) {
    setSelectedId(boardId)
    startTransition(async () => {
      const res = await getProjectGradebook(boardId)
      setGradebook(res.data ?? null)
    })
  }

  // ── Save final grade (optimistic) ──

  async function handleSave(studentId: string | null, score: number, maxScore: number) {
    if (!gradebook) return
    const key = studentId ?? '__project__'
    setSavingId(key)

    // Optimistic update
    setGradebook((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        entries: prev.entries.map((e) => {
          if (entryKey(e) !== key) return e
          return { ...e, finalScore: score, finalMax: maxScore, hasFinalGrade: true }
        }),
      }
    })

    const res = await setFinalGrade(gradebook.boardId, studentId, score, maxScore)
    setSavingId(null)

    if (res.error) {
      // Revert on error: re-fetch
      startTransition(async () => {
        const fresh = await getProjectGradebook(gradebook.boardId)
        setGradebook(fresh.data ?? null)
      })
    }
  }

  // ── CSV export ──

  function handleExportCsv() {
    if (!gradebook) return
    const headers: string[] = [
      t('student'),
      'Email',
      t('teamRole'),
      ...gradebook.criteria.map((c) => `${c.title} (/${c.max_score})`),
      t('rubricTotal'),
      t('rubricMax'),
      '%',
      t('finalGrade'),
      t('finalMax'),
      t('finalComment'),
    ]
    const rows = gradebook.entries.map((e) => [
      e.studentId === null ? t('wholeProject') : (e.studentName ?? e.studentEmail),
      e.studentId === null ? '' : e.studentEmail,
      e.teamRole ?? '',
      ...e.criteriaScores.map((cs) => cs.score),
      e.rubricTotal,
      e.rubricMax,
      e.rubricPercent,
      e.finalScore,
      e.finalMax,
      e.finalComment ?? '',
    ])
    downloadCsv([headers, ...rows], `journal_${gradebook.boardTitle}.csv`)
  }

  // ── Render ──

  const criteria = gradebook?.criteria ?? []
  const students = gradebook?.entries.filter((e) => e.studentId !== null) ?? []
  const projectEntry = gradebook?.entries.find((e) => e.studentId === null) ?? null

  return (
    <div className="p-4 sm:p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-100 rounded-xl p-2">
            <BookText size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
            {gradebook && (
              <p className="text-sm text-gray-500">{gradebook.boardTitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Project selector */}
          {boards.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => handleBoardChange(e.target.value)}
              disabled={isPending}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleExportCsv}
            disabled={!gradebook}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200
                       bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download size={15} />
            <span className="hidden sm:inline">{t('exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* Empty state */}
      {boards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-brand-50 rounded-2xl p-6 mb-4">
            <BookText className="text-brand-300" size={44} />
          </div>
          <p className="text-base font-medium text-gray-900">{t('noProjects')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('noProjectsHint')}</p>
        </div>
      )}

      {/* Loading spinner while switching projects */}
      {isPending && (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {!isPending && gradebook && (
        <>
          {/* Summary cards */}
          <div className="flex flex-wrap gap-3 mb-6">
            <SummaryCard
              label={t('avgScore')}
              value={gradebook.avgRubricPercent !== null ? `${gradebook.avgRubricPercent}%` : '—'}
            />
            <SummaryCard
              label={t('graded')}
              value={gradebook.gradedCount}
              sub={`${t('of')} ${gradebook.totalStudents}`}
            />
            <SummaryCard
              label={t('notGraded')}
              value={gradebook.totalStudents - gradebook.gradedCount}
            />
            {criteria.length > 0 && (
              <SummaryCard
                label={t('rubricMax')}
                value={criteria.reduce((s, c) => s + c.max_score, 0)}
              />
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {/* Sticky first column */}
                    <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap min-w-[160px] border-r border-gray-100">
                      {t('student')}
                    </th>
                    {criteria.map((c) => (
                      <CriterionHeader key={c.id} criterion={c} />
                    ))}
                    {criteria.length > 0 && (
                      <th className="px-3 py-3 font-medium text-gray-600 whitespace-nowrap text-right">
                        {t('rubricTotal')}
                      </th>
                    )}
                    <th className="px-3 py-3 font-medium text-gray-600 whitespace-nowrap text-center min-w-[150px]">
                      {t('finalGrade')}
                      <span className="ml-1 text-[10px] font-normal text-gray-400">({t('editable')})</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {students.length === 0 && (
                    <tr>
                      <td
                        colSpan={criteria.length + 3}
                        className="px-4 py-10 text-center text-gray-400 text-sm"
                      >
                        {t('noStudents')}
                      </td>
                    </tr>
                  )}

                  {students.map((entry) => (
                    <StudentRow
                      key={entry.studentId!}
                      entry={entry}
                      criteria={criteria}
                      savingId={savingId}
                      onSave={handleSave}
                      t={t}
                    />
                  ))}

                  {/* Whole-project row */}
                  {projectEntry && (
                    <ProjectRow
                      entry={projectEntry}
                      criteria={criteria}
                      savingId={savingId}
                      onSave={handleSave}
                      t={t}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            ★ — {t('manualOverride')}
          </p>
        </>
      )}
    </div>
  )
}

// ── Criterion header ──────────────────────────────────────────────────────────

function CriterionHeader({ criterion }: { criterion: RubricCriterion }) {
  return (
    <th
      className="px-3 py-3 font-medium text-gray-600 text-right whitespace-nowrap max-w-[120px]"
      title={criterion.title}
    >
      <span className="block truncate text-right" style={{ maxWidth: 100 }}>
        {criterion.title}
      </span>
      <span className="block text-[10px] font-normal text-gray-400">/{criterion.max_score}</span>
    </th>
  )
}

// ── Student row ───────────────────────────────────────────────────────────────

interface RowProps {
  entry: GradebookStudentEntry
  criteria: RubricCriterion[]
  savingId: string | null
  onSave: (sid: string | null, score: number, max: number) => Promise<void>
  t: ReturnType<typeof useTranslations<'gradebook'>>
}

function StudentRow({ entry, criteria, savingId, onSave, t }: RowProps) {
  const key = entryKey(entry)
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 transition-colors px-4 py-2.5 border-r border-gray-100 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 text-sm">
            {entry.studentName ?? entry.studentEmail}
          </span>
          {entry.studentName && (
            <span className="text-[11px] text-gray-400">{entry.studentEmail}</span>
          )}
          {entry.teamRole && (
            <span className="text-[10px] text-brand-600 font-medium mt-0.5">
              {t(`teamRole_${entry.teamRole}` as Parameters<typeof t>[0])}
            </span>
          )}
        </div>
      </td>

      {criteria.map((c) => {
        const cs = entry.criteriaScores.find((s) => s.criterionId === c.id)
        return (
          <td key={c.id} className="px-3 py-2.5 text-right">
            <ScoreChip score={cs?.score ?? null} max={c.max_score} />
          </td>
        )
      })}

      {criteria.length > 0 && (
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <ScoreChip
            score={entry.criteriaScores.some((cs) => cs.score !== null) ? entry.rubricTotal : null}
            max={entry.rubricMax}
            colored
          />
        </td>
      )}

      <td className="px-3 py-2.5 text-center">
        <GradeCell
          entry={entry}
          onSave={onSave}
          saving={savingId === key}
        />
      </td>
    </tr>
  )
}

// ── Project (whole) row ───────────────────────────────────────────────────────

function ProjectRow({ entry, criteria, savingId, onSave, t }: RowProps) {
  const key = entryKey(entry)
  return (
    <tr className="border-t-2 border-dashed border-gray-200 bg-gray-50/60">
      <td className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 border-r border-gray-100 whitespace-nowrap">
        <span className="text-sm font-semibold text-gray-600 italic">{t('wholeProject')}</span>
      </td>

      {criteria.map((c) => {
        const cs = entry.criteriaScores.find((s) => s.criterionId === c.id)
        return (
          <td key={c.id} className="px-3 py-2.5 text-right">
            <ScoreChip score={cs?.score ?? null} max={c.max_score} />
          </td>
        )
      })}

      {criteria.length > 0 && (
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <ScoreChip
            score={entry.criteriaScores.some((cs) => cs.score !== null) ? entry.rubricTotal : null}
            max={entry.rubricMax}
            colored
          />
        </td>
      )}

      <td className="px-3 py-2.5 text-center">
        <GradeCell
          entry={entry}
          onSave={onSave}
          saving={savingId === key}
        />
      </td>
    </tr>
  )
}
