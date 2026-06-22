'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  ClipboardCheck, X, Loader2, Plus, Trash2, Sparkles, Check, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getRubric,
  getGrades,
  addCriterion,
  updateCriterion,
  deleteCriterion,
  applyStandardRubric,
  setGrade,
} from '@/actions/grading'
import { getStudentFinalGrade } from '@/actions/gradebook'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { RubricCriterion, Grade, MemberWithProfile, FinalGrade } from '@/lib/types'

interface GradingButtonProps {
  boardId: string
  currentUserId: string
  isOwner: boolean
  members: MemberWithProfile[]
}

type GradeDraft = { score: string; comment: string }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const PROJECT = 'project'

export function GradingButton({ boardId, currentUserId, isOwner, members }: GradingButtonProps) {
  const t = useTranslations('grading')
  const tc = useTranslations('common')

  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [criteria, setCriteria] = useState<RubricCriterion[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [finalGrade, setFinalGrade] = useState<FinalGrade | null>(null)
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  // Which student/project is being graded (teacher selects; student is always self)
  const [target, setTarget] = useState<string>(PROJECT)
  const students = useMemo(() => members.filter((m) => m.role !== 'owner'), [members])
  const effectiveTarget = isOwner ? target : currentUserId
  const targetStudentId = effectiveTarget === PROJECT ? null : effectiveTarget
  const effectiveTargetRef = useRef(effectiveTarget)
  effectiveTargetRef.current = effectiveTarget

  // ── Draft state (teacher only) ──
  // baseline = last-saved values per criterion; drafts = in-progress edits.
  // Dirty when drafts differ from baseline for any criterion.
  const [drafts, setDrafts] = useState<Record<string, GradeDraft>>({})
  const [baseline, setBaseline] = useState<Record<string, GradeDraft>>({})

  // Save lifecycle
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const isDirty = useMemo(() => {
    if (!isOwner || !loaded || criteria.length === 0) return false
    return criteria.some((c) => {
      const b = baseline[c.id] ?? { score: '', comment: '' }
      const d = drafts[c.id] ?? b
      return d.score !== b.score || d.comment !== b.comment
    })
  }, [criteria, baseline, drafts, isOwner, loaded])

  // Ref so event handlers (keyboard, backdrop) always see the current isDirty
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  // ── Helpers ──

  function computeBaseline(
    gradesData: Grade[],
    criteriaData: RubricCriterion[],
    targetId: string,
  ): Record<string, GradeDraft> {
    const result: Record<string, GradeDraft> = {}
    criteriaData.forEach((c) => {
      let grade: Grade | undefined
      if (isOwner) {
        grade = gradesData.find(
          (g) => g.criterion_id === c.id && (g.student_id ?? PROJECT) === targetId,
        )
      } else {
        grade = gradesData.find((g) => g.criterion_id === c.id && g.student_id === currentUserId)
          ?? gradesData.find((g) => g.criterion_id === c.id && g.student_id === null)
      }
      result[c.id] = {
        score: grade?.score != null ? String(grade.score) : '',
        comment: grade?.comment ?? '',
      }
    })
    return result
  }

  function reload() {
    startTransition(async () => {
      const studentIdForFinal = isOwner ? null : currentUserId
      const [r, g, fg] = await Promise.all([
        getRubric(boardId),
        getGrades(boardId),
        getStudentFinalGrade(boardId, studentIdForFinal),
      ])
      const crit = r.data ?? []
      const gr = g.data ?? []
      setCriteria(crit)
      setGrades(gr)
      setFinalGrade(fg.data ?? null)
      // Init drafts from freshly loaded server data
      const bl = computeBaseline(gr, crit, effectiveTargetRef.current)
      setBaseline(bl)
      setDrafts(bl)
      setSaveStatus('idle')
      setSaveError(null)
      setLoaded(true)
    })
  }

  useEffect(() => {
    if (open) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boardId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isDirtyRef.current && !confirm(t('discardConfirm'))) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Grade lookup for student view (uses server grades, not drafts)
  function gradeFor(criterionId: string): Grade | undefined {
    if (isOwner) {
      return grades.find(
        (g) => g.criterion_id === criterionId && (g.student_id ?? PROJECT) === effectiveTarget,
      )
    }
    const personal = grades.find(
      (g) => g.criterion_id === criterionId && g.student_id === currentUserId,
    )
    if (personal) return personal
    return grades.find((g) => g.criterion_id === criterionId && g.student_id === null)
  }

  const maxTotal = useMemo(() => criteria.reduce((s, c) => s + c.max_score, 0), [criteria])

  // Teacher: live total from draft values (recalculates as user types)
  // Student: total from server grades
  const earned = useMemo(() => {
    if (isOwner) {
      return criteria.reduce((sum, c) => {
        const d = drafts[c.id] ?? baseline[c.id]
        const raw = d ? (d.score === '' ? 0 : Number(d.score)) : 0
        return sum + Math.min(Math.max(0, raw), c.max_score)
      }, 0)
    }
    return criteria.reduce((s, c) => s + Number(gradeFor(c.id)?.score ?? 0), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, grades, drafts, baseline, effectiveTarget, isOwner])

  const percent = maxTotal > 0 ? Math.round((earned / maxTotal) * 100) : 0
  const anyGraded = criteria.some((c) => gradeFor(c.id) !== undefined)

  const targetLabel =
    effectiveTarget === PROJECT
      ? t('wholeProject')
      : students.find((s) => s.user_id === effectiveTarget)?.full_name ||
        students.find((s) => s.user_id === effectiveTarget)?.email ||
        ''

  // ── Close with dirty guard ──
  function handleClose() {
    if (isDirtyRef.current && !confirm(t('discardConfirm'))) return
    setOpen(false)
  }

  // ── Target switch with dirty guard ──
  function handleTargetChange(newTarget: string) {
    if (isDirty && !confirm(t('switchConfirm'))) return
    setSaveStatus('idle')
    setSaveError(null)
    setTarget(newTarget)
    // Re-init drafts from current in-memory grades for the new target
    const bl = computeBaseline(grades, criteria, newTarget)
    setBaseline(bl)
    setDrafts(bl)
  }

  // ── Draft update ──
  function handleDraftChange(criterionId: string, field: 'score' | 'comment', value: string) {
    setDrafts((prev) => ({
      ...prev,
      [criterionId]: {
        ...(prev[criterionId] ?? baseline[criterionId] ?? { score: '', comment: '' }),
        [field]: value,
      },
    }))
    // Reset stale save feedback when user starts editing again
    if (saveStatus === 'saved' || saveStatus === 'error') {
      setSaveStatus('idle')
      setSaveError(null)
    }
  }

  // ── Explicit save ──
  async function handleSaveGrades() {
    setIsSaving(true)
    setSaveStatus('saving')
    setSaveError(null)

    try {
      const results = await Promise.all(
        criteria.map((c) => {
          const d = drafts[c.id] ?? baseline[c.id] ?? { score: '', comment: '' }
          const score = d.score === '' ? 0 : Math.min(Math.max(0, Number(d.score)), c.max_score)
          return setGrade(boardId, c.id, targetStudentId, score, d.comment)
        }),
      )

      const firstError = results.find((r) => r && 'error' in r && r.error)
      if (firstError && 'error' in firstError) {
        setSaveError(firstError.error ?? t('saveError'))
        setSaveStatus('error')
        setIsSaving(false)
        return
      }
    } catch {
      setSaveError(t('saveError'))
      setSaveStatus('error')
      setIsSaving(false)
      return
    }

    // Success: baseline now matches what we just wrote
    setBaseline({ ...drafts })
    setSaveStatus('saved')
    setIsSaving(false)
    setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)

    // Refresh only final grade (avoid re-initing drafts via full reload)
    const fg = await getStudentFinalGrade(boardId, isOwner ? null : currentUserId)
    setFinalGrade(fg.data ?? null)
  }

  // ── Rubric management (unchanged logic) ──

  function handleApplyStandard() {
    setBusy(true)
    startTransition(async () => {
      await applyStandardRubric(boardId)
      setBusy(false)
      reload()
    })
  }

  function handleAddCriterion() {
    setBusy(true)
    startTransition(async () => {
      const res = await addCriterion(boardId, t('newCriterionTitle'), 10)
      setBusy(false)
      if (res.data) {
        const c = res.data as RubricCriterion
        setCriteria((prev) => [...prev, c])
        const empty = { score: '', comment: '' }
        setDrafts((prev) => ({ ...prev, [c.id]: empty }))
        setBaseline((prev) => ({ ...prev, [c.id]: empty }))
      }
    })
  }

  function handleUpdateCriterion(id: string, patch: { title?: string; max_score?: number }) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    startTransition(() => { void updateCriterion(boardId, id, patch) })
  }

  function handleDeleteCriterion(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id))
    setGrades((prev) => prev.filter((g) => g.criterion_id !== id))
    setDrafts((prev) => { const n = { ...prev }; delete n[id]; return n })
    setBaseline((prev) => { const n = { ...prev }; delete n[id]; return n })
    startTransition(() => { void deleteCriterion(boardId, id) })
  }

  // ── Render ──

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-2 sm:px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
      >
        <ClipboardCheck size={16} className="shrink-0" />
        <span className="hidden sm:inline">{t('title')}</span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-overlay-in"
              onClick={handleClose}
            />

            <aside className="absolute inset-y-0 right-0 w-full sm:w-[560px] bg-white shadow-pop flex flex-col animate-drawer-in">
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-brand-600" />
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('title')}</h2>
                </div>
                <button
                  onClick={handleClose}
                  aria-label={tc('close')}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin">
                {isPending && !loaded ? (
                  <div className="flex items-center justify-center py-20 text-gray-400">
                    <Loader2 size={22} className="animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Student selector (teacher only, when rubric exists) */}
                    {isOwner && criteria.length > 0 && (
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          {t('gradingTarget')}
                        </label>
                        <Select value={target} onChange={(e) => handleTargetChange(e.target.value)}>
                          <option value={PROJECT}>{t('wholeProject')}</option>
                          {students.map((s) => (
                            <option key={s.user_id} value={s.user_id}>
                              {s.full_name || s.email}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}

                    {/* Empty state */}
                    {criteria.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="bg-brand-50 rounded-2xl p-5 mb-4">
                          <ClipboardCheck className="text-brand-400" size={40} />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{t('emptyTitle')}</p>
                        <p className="text-xs text-gray-500 mt-1 max-w-[16rem]">
                          {isOwner ? t('emptyBodyTeacher') : t('emptyBodyStudent')}
                        </p>
                        {isOwner && (
                          <div className="flex flex-col gap-2 mt-5 w-full max-w-xs">
                            <Button onClick={handleApplyStandard} disabled={busy}>
                              <Sparkles size={15} className="mr-1.5" />
                              {t('applyStandard')}
                            </Button>
                            <Button variant="outline" onClick={handleAddCriterion} disabled={busy}>
                              <Plus size={15} className="mr-1.5" />
                              {t('addCriterion')}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {!isOwner && (
                          <p className="text-xs text-gray-500 mb-3">{t('studentHint')}</p>
                        )}

                        <ul className="space-y-2.5">
                          {criteria.map((c) => {
                            const draft = drafts[c.id] ?? baseline[c.id] ?? { score: '', comment: '' }
                            return (
                              <li key={c.id} className="rounded-xl border border-gray-200 p-3">
                                {isOwner ? (
                                  <TeacherCriterionRow
                                    criterion={c}
                                    score={draft.score}
                                    comment={draft.comment}
                                    onScoreChange={(v) => handleDraftChange(c.id, 'score', v)}
                                    onCommentChange={(v) => handleDraftChange(c.id, 'comment', v)}
                                    onTitle={(title) => handleUpdateCriterion(c.id, { title })}
                                    onMax={(max_score) => handleUpdateCriterion(c.id, { max_score })}
                                    onDelete={() => handleDeleteCriterion(c.id)}
                                    scoreLabel={t('score')}
                                    maxLabel={t('maxScore')}
                                    commentPlaceholder={t('commentPlaceholder')}
                                    deleteLabel={t('deleteCriterion')}
                                  />
                                ) : (
                                  <StudentCriterionRow
                                    criterion={c}
                                    grade={gradeFor(c.id)}
                                    notGradedLabel={t('notGraded')}
                                    ofLabel={t('outOf', { max: c.max_score })}
                                  />
                                )}
                              </li>
                            )
                          })}
                        </ul>

                        {isOwner && (
                          <button
                            onClick={handleAddCriterion}
                            disabled={busy}
                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-40"
                          >
                            <Plus size={15} />
                            {t('addCriterion')}
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* ── Footer: total + save (teacher) / total (student) ── */}
              {criteria.length > 0 && (
                <div className="border-t border-gray-200 p-4 sm:p-5 shrink-0 bg-gray-50 space-y-3">
                  {/* Total score bar */}
                  {!isOwner && !anyGraded ? (
                    <p className="text-sm text-center text-gray-500">{t('notGradedYet')}</p>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {isOwner && targetLabel
                            ? `${t('totalScore')} · ${targetLabel}`
                            : t('totalScore')}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {t('scoreOfMax', { score: earned, max: maxTotal })} · {percent}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            percent >= 75
                              ? 'bg-emerald-500'
                              : percent >= 50
                              ? 'bg-amber-500'
                              : 'bg-brand-500',
                          )}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </>
                  )}

                  {/* ── Save button (teacher only) ── */}
                  {isOwner && (
                    <div className="space-y-1.5 pt-0.5">
                      {/* Unsaved indicator */}
                      {isDirty && saveStatus !== 'saving' && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                          <AlertCircle size={12} />
                          {t('unsaved')}
                        </div>
                      )}
                      {/* Error message */}
                      {saveStatus === 'error' && saveError && (
                        <p className="text-xs text-red-600">{saveError}</p>
                      )}
                      <button
                        onClick={handleSaveGrades}
                        disabled={isSaving || (!isDirty && saveStatus !== 'error')}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm transition-all duration-150',
                          saveStatus === 'saved'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : isDirty || saveStatus === 'error'
                            ? 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                        )}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            {t('saving')}
                          </>
                        ) : saveStatus === 'saved' ? (
                          <>
                            <Check size={16} />
                            {t('saved')}
                          </>
                        ) : (
                          t('save')
                        )}
                      </button>
                    </div>
                  )}

                  {/* Final grade from gradebook */}
                  {finalGrade && (
                    <div
                      className={cn(
                        'rounded-lg px-3 py-2.5 flex items-center justify-between',
                        finalGrade.final_score / finalGrade.max_score >= 0.75
                          ? 'bg-emerald-50 border border-emerald-200'
                          : finalGrade.final_score / finalGrade.max_score >= 0.5
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-red-50 border border-red-200',
                      )}
                    >
                      <span className="text-xs font-medium text-gray-600">{t('finalGradeLabel')}</span>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">
                        {Number(finalGrade.final_score)}/{Number(finalGrade.max_score)}{' '}
                        <span className="text-xs font-normal text-gray-500">
                          ({Math.round((finalGrade.final_score / finalGrade.max_score) * 100)}%)
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>,
          document.body,
        )}
    </>
  )
}

// ── Controlled criterion row for teacher: no auto-save on blur ──
function TeacherCriterionRow({
  criterion,
  score,
  comment,
  onScoreChange,
  onCommentChange,
  onTitle,
  onMax,
  onDelete,
  scoreLabel,
  maxLabel,
  commentPlaceholder,
  deleteLabel,
}: {
  criterion: RubricCriterion
  score: string
  comment: string
  onScoreChange: (v: string) => void
  onCommentChange: (v: string) => void
  onTitle: (title: string) => void
  onMax: (max: number) => void
  onDelete: () => void
  scoreLabel: string
  maxLabel: string
  commentPlaceholder: string
  deleteLabel: string
}) {
  return (
    <div className="space-y-2">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <Input
          value={criterion.title}
          onChange={(e) => onTitle(e.target.value)}
          className="h-9 flex-1 font-medium"
        />
        <button
          onClick={onDelete}
          title={deleteLabel}
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Score + max */}
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-[11px] font-medium text-gray-400 mb-1">{scoreLabel}</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={criterion.max_score}
            value={score}
            onChange={(e) => onScoreChange(e.target.value)}
            className="h-9"
          />
        </label>
        <label className="w-20 shrink-0">
          <span className="block text-[11px] font-medium text-gray-400 mb-1">{maxLabel}</span>
          <Input
            type="number"
            min={0}
            value={criterion.max_score}
            onChange={(e) => onMax(Number(e.target.value))}
            className="h-9"
          />
        </label>
      </div>

      {/* Comment */}
      <Input
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder={commentPlaceholder}
        className="h-9 text-sm"
      />
    </div>
  )
}

// ── Read-only criterion row for student ──
function StudentCriterionRow({
  criterion,
  grade,
  notGradedLabel,
  ofLabel,
}: {
  criterion: RubricCriterion
  grade?: Grade
  notGradedLabel: string
  ofLabel: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-900">{criterion.title}</span>
        {grade ? (
          <span className="text-sm font-semibold text-gray-900 shrink-0">
            {Number(grade.score)}{' '}
            <span className="text-gray-400 font-normal">/ {criterion.max_score}</span>
          </span>
        ) : (
          <span className="text-xs text-gray-400 shrink-0">{notGradedLabel}</span>
        )}
      </div>
      <span className="sr-only">{ofLabel}</span>
      {grade?.comment && <p className="mt-1 text-xs text-gray-500">{grade.comment}</p>}
    </div>
  )
}
