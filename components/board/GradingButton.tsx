'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { ClipboardCheck, X, Loader2, Plus, Trash2, Sparkles } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { RubricCriterion, Grade, MemberWithProfile } from '@/lib/types'

interface GradingButtonProps {
  boardId: string
  currentUserId: string
  isOwner: boolean
  members: MemberWithProfile[]
}

// Ключ цели оценивания: 'project' = весь проект, иначе user_id студента.
const PROJECT = 'project'

export function GradingButton({ boardId, currentUserId, isOwner, members }: GradingButtonProps) {
  const t = useTranslations('grading')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [criteria, setCriteria] = useState<RubricCriterion[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  // Цель оценивания: для преподавателя выбирается, для студента — он сам.
  const [target, setTarget] = useState<string>(PROJECT)
  const students = useMemo(() => members.filter((m) => m.role !== 'owner'), [members])
  const effectiveTarget = isOwner ? target : currentUserId
  const targetStudentId = effectiveTarget === PROJECT ? null : effectiveTarget

  function reload() {
    startTransition(async () => {
      const [r, g] = await Promise.all([getRubric(boardId), getGrades(boardId)])
      setCriteria(r.data ?? [])
      setGrades(g.data ?? [])
      setLoaded(true)
    })
  }

  useEffect(() => {
    if (open) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boardId])

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

  // Для студента оценку резолвим: личная, иначе общая по проекту.
  function gradeFor(criterionId: string): Grade | undefined {
    if (isOwner) {
      return grades.find(
        (g) => g.criterion_id === criterionId && (g.student_id ?? PROJECT) === effectiveTarget,
      )
    }
    const personal = grades.find((g) => g.criterion_id === criterionId && g.student_id === currentUserId)
    if (personal) return personal
    return grades.find((g) => g.criterion_id === criterionId && g.student_id === null)
  }

  const maxTotal = useMemo(() => criteria.reduce((s, c) => s + c.max_score, 0), [criteria])
  const earned = useMemo(
    () => criteria.reduce((s, c) => s + Number(gradeFor(c.id)?.score ?? 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [criteria, grades, effectiveTarget],
  )
  const percent = maxTotal > 0 ? Math.round((earned / maxTotal) * 100) : 0
  const anyGraded = criteria.some((c) => gradeFor(c.id) !== undefined)

  // ── Действия преподавателя ──
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
      if (res.data) setCriteria((prev) => [...prev, res.data as RubricCriterion])
    })
  }

  function handleUpdateCriterion(id: string, patch: { title?: string; max_score?: number }) {
    // Оптимистично правим локально, затем сохраняем.
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    startTransition(() => {
      void updateCriterion(boardId, id, patch)
    })
  }

  function handleDeleteCriterion(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id))
    setGrades((prev) => prev.filter((g) => g.criterion_id !== id))
    startTransition(() => {
      void deleteCriterion(boardId, id)
    })
  }

  // Сохранение оценки с оптимистичным обновлением локального списка.
  function persistGrade(criterion: RubricCriterion, score: number, comment: string) {
    const clamped = Math.min(Math.max(0, score), criterion.max_score)
    setGrades((prev) => {
      const idx = prev.findIndex(
        (g) => g.criterion_id === criterion.id && (g.student_id ?? PROJECT) === effectiveTarget,
      )
      const base: Grade = {
        id: idx >= 0 ? prev[idx].id : `tmp-${criterion.id}-${effectiveTarget}`,
        board_id: boardId,
        criterion_id: criterion.id,
        student_id: targetStudentId,
        score: clamped,
        comment: comment.trim() || null,
        graded_by: currentUserId,
        created_at: idx >= 0 ? prev[idx].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = base
        return next
      }
      return [...prev, base]
    })
    startTransition(() => {
      void setGrade(boardId, criterion.id, targetStudentId, clamped, comment)
    })
  }

  const targetLabel =
    effectiveTarget === PROJECT
      ? t('wholeProject')
      : students.find((s) => s.user_id === effectiveTarget)?.full_name ||
        students.find((s) => s.user_id === effectiveTarget)?.email ||
        ''

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
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
              onClick={() => setOpen(false)}
            />

            <aside className="absolute inset-y-0 right-0 w-full sm:w-[560px] bg-white shadow-pop flex flex-col animate-drawer-in">
              {/* Header */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-brand-600" />
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('title')}</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={tc('close')}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin">
                {isPending && !loaded ? (
                  <div className="flex items-center justify-center py-20 text-gray-400">
                    <Loader2 size={22} className="animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Выбор кого оцениваем — только преподаватель */}
                    {isOwner && criteria.length > 0 && (
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('gradingTarget')}</label>
                        <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                          <option value={PROJECT}>{t('wholeProject')}</option>
                          {students.map((s) => (
                            <option key={s.user_id} value={s.user_id}>
                              {s.full_name || s.email}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}

                    {/* Пустая рубрика */}
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
                        {/* Студенту — заголовок «оцениваетесь вы» */}
                        {!isOwner && (
                          <p className="text-xs text-gray-500 mb-3">{t('studentHint')}</p>
                        )}

                        <ul className="space-y-2.5">
                          {criteria.map((c) => {
                            const grade = gradeFor(c.id)
                            return (
                              <li key={c.id} className="rounded-xl border border-gray-200 p-3">
                                {isOwner ? (
                                  <TeacherCriterionRow
                                    criterion={c}
                                    grade={grade}
                                    onTitle={(title) => handleUpdateCriterion(c.id, { title })}
                                    onMax={(max_score) => handleUpdateCriterion(c.id, { max_score })}
                                    onDelete={() => handleDeleteCriterion(c.id)}
                                    onGrade={(score, comment) => persistGrade(c, score, comment)}
                                    scoreLabel={t('score')}
                                    maxLabel={t('maxScore')}
                                    commentPlaceholder={t('commentPlaceholder')}
                                    deleteLabel={t('deleteCriterion')}
                                  />
                                ) : (
                                  <StudentCriterionRow
                                    criterion={c}
                                    grade={grade}
                                    notGradedLabel={t('notGraded')}
                                    ofLabel={t('outOf', { max: c.max_score })}
                                  />
                                )}
                              </li>
                            )
                          })}
                        </ul>

                        {/* Добавить критерий — преподаватель */}
                        {isOwner && (
                          <button
                            onClick={handleAddCriterion}
                            disabled={busy}
                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
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

              {/* Итог */}
              {criteria.length > 0 && (
                <div className="border-t border-gray-200 p-4 sm:p-5 shrink-0 bg-gray-50">
                  {!isOwner && !anyGraded ? (
                    <p className="text-sm text-center text-gray-500">{t('notGradedYet')}</p>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {isOwner && targetLabel ? `${t('totalScore')} · ${targetLabel}` : t('totalScore')}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {t('scoreOfMax', { score: earned, max: maxTotal })} · {percent}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            percent >= 75 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-brand-500',
                          )}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </>
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

// ── Строка критерия для преподавателя: правка рубрики + ввод балла ──
function TeacherCriterionRow({
  criterion,
  grade,
  onTitle,
  onMax,
  onDelete,
  onGrade,
  scoreLabel,
  maxLabel,
  commentPlaceholder,
  deleteLabel,
}: {
  criterion: RubricCriterion
  grade?: Grade
  onTitle: (title: string) => void
  onMax: (max: number) => void
  onDelete: () => void
  onGrade: (score: number, comment: string) => void
  scoreLabel: string
  maxLabel: string
  commentPlaceholder: string
  deleteLabel: string
}) {
  const [score, setScore] = useState(grade?.score != null ? String(grade.score) : '')
  const [comment, setComment] = useState(grade?.comment ?? '')

  // Синхронизация при смене цели/перезагрузке.
  const [prevGradeId, setPrevGradeId] = useState(grade?.id)
  if (grade?.id !== prevGradeId) {
    setPrevGradeId(grade?.id)
    setScore(grade?.score != null ? String(grade.score) : '')
    setComment(grade?.comment ?? '')
  }

  function save() {
    onGrade(score === '' ? 0 : Number(score), comment)
  }

  return (
    <div className="space-y-2">
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

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-[11px] font-medium text-gray-400 mb-1">{scoreLabel}</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={criterion.max_score}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            onBlur={save}
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

      <Input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={save}
        placeholder={commentPlaceholder}
        className="h-9 text-sm"
      />
    </div>
  )
}

// ── Строка критерия для студента: только просмотр ──
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
            {Number(grade.score)} <span className="text-gray-400 font-normal">/ {criterion.max_score}</span>
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
