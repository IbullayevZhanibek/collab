'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  X,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMyReflections, getProjectReflections, saveReflection } from '@/actions/reflections'
import { Button } from '@/components/ui/button'
import type { Reflection, ReflectionWithMeta, ProjectStage, MemberWithProfile } from '@/lib/types'

interface ReflectionButtonProps {
  boardId: string
  currentUserId: string
  isOwner: boolean
  stages: ProjectStage[]
  members: MemberWithProfile[]
}

type FormFields = {
  whatDone: string
  difficulties: string
  improvements: string
  contribution: string
}

type FormTarget = { stageId: string | null; stageTitle: string }

const EMPTY_FORM: FormFields = {
  whatDone: '',
  difficulties: '',
  improvements: '',
  contribution: '',
}

export function ReflectionButton({
  boardId,
  currentUserId,
  isOwner,
  stages,
  members,
}: ReflectionButtonProps) {
  const t = useTranslations('reflection')
  const tc = useTranslations('common')

  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startLoad] = useTransition()

  // Student state
  const [myReflections, setMyReflections] = useState<Reflection[]>([])
  const [view, setView] = useState<'list' | 'form'>('list')
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [formData, setFormData] = useState<FormFields>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  // Teacher state
  const [allReflections, setAllReflections] = useState<ReflectionWithMeta[]>([])
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [viewingKey, setViewingKey] = useState<string | null>(null)

  const students = members.filter((m) => m.role !== 'owner')

  function reload() {
    startLoad(async () => {
      if (isOwner) {
        const { data } = await getProjectReflections(boardId)
        setAllReflections(data ?? [])
      } else {
        const { data } = await getMyReflections(boardId)
        setMyReflections(data ?? [])
      }
      setLoaded(true)
    })
  }

  useEffect(() => {
    if (open) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (view === 'form') { setView('list'); return }
      setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, view])

  // Reset view state when drawer is closed.
  useEffect(() => {
    if (!open) {
      setView('list')
      setFormTarget(null)
      setFormError(null)
      setExpandedStudent(null)
      setViewingKey(null)
    }
  }, [open])

  function openForm(target: FormTarget) {
    const existing = myReflections.find((r) =>
      target.stageId !== null ? r.stage_id === target.stageId : r.stage_id === null,
    )
    setFormData(
      existing
        ? {
            whatDone: existing.what_done ?? '',
            difficulties: existing.difficulties ?? '',
            improvements: existing.improvements ?? '',
            contribution: existing.contribution ?? '',
          }
        : EMPTY_FORM,
    )
    setFormError(null)
    setFormTarget(target)
    setView('form')
  }

  function handleSave() {
    if (!formTarget) return
    startSave(async () => {
      const res = await saveReflection(boardId, formTarget.stageId, formData)
      if (res.error) { setFormError(res.error); return }

      const prevId = myReflections.find((r) =>
        formTarget.stageId !== null
          ? r.stage_id === formTarget.stageId
          : r.stage_id === null,
      )?.id

      const updated: Reflection = {
        id: prevId ?? '',
        board_id: boardId,
        stage_id: formTarget.stageId,
        student_id: currentUserId,
        what_done: formData.whatDone.trim() || null,
        difficulties: formData.difficulties.trim() || null,
        improvements: formData.improvements.trim() || null,
        contribution: formData.contribution.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setMyReflections((prev) => {
        const without = prev.filter((r) =>
          formTarget.stageId !== null
            ? r.stage_id !== formTarget.stageId
            : r.stage_id !== null,
        )
        return [...without, updated]
      })
      setView('list')
    })
  }

  // Teacher: group by student_id → Map<stageId | null, reflection>
  const byStudent = new Map<string, Map<string | null, ReflectionWithMeta>>()
  for (const r of allReflections) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, new Map())
    byStudent.get(r.student_id)!.set(r.stage_id, r)
  }

  function backdropClick() {
    if (view === 'form') { setView('list'); return }
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-2 sm:px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-600 shrink-0"
      >
        <BookOpen size={16} className="shrink-0" />
        <span className="hidden sm:inline">{t('title')}</span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-overlay-in"
              onClick={backdropClick}
            />

            <aside className="absolute inset-y-0 right-0 w-full sm:w-[560px] bg-white shadow-pop flex flex-col animate-drawer-in">
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 shrink-0">
                {view === 'form' ? (
                  <button
                    onClick={() => setView('list')}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeft size={16} />
                    {t('backToList')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-brand-600" />
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('title')}</h2>
                  </div>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label={tc('close')}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin">
                {isPending && !loaded ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={22} className="animate-spin text-gray-400" />
                  </div>
                ) : view === 'form' && formTarget ? (
                  <ReflectionForm
                    target={formTarget}
                    data={formData}
                    onChange={setFormData}
                    onSave={handleSave}
                    onCancel={() => setView('list')}
                    isSaving={isSaving}
                    error={formError}
                  />
                ) : isOwner ? (
                  <TeacherView
                    stages={stages}
                    students={students}
                    byStudent={byStudent}
                    expandedStudent={expandedStudent}
                    viewingKey={viewingKey}
                    onToggleStudent={(id) =>
                      setExpandedStudent((prev) => (prev === id ? null : id))
                    }
                    onToggleViewing={(key) =>
                      setViewingKey((prev) => (prev === key ? null : key))
                    }
                  />
                ) : (
                  <StudentView
                    stages={stages}
                    myReflections={myReflections}
                    onOpenForm={openForm}
                  />
                )}
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  )
}

// ── Форма рефлексии (student view → form view) ──
function ReflectionForm({
  target,
  data,
  onChange,
  onSave,
  onCancel,
  isSaving,
  error,
}: {
  target: FormTarget
  data: FormFields
  onChange: (d: FormFields) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  error: string | null
}) {
  const t = useTranslations('reflection')
  const tc = useTranslations('common')

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSave()
    }
  }

  const fields = [
    { key: 'whatDone' as const, placeholder: t('whatDonePlaceholder') },
    { key: 'difficulties' as const, placeholder: t('difficultiesPlaceholder') },
    { key: 'improvements' as const, placeholder: t('improvementsPlaceholder') },
    { key: 'contribution' as const, placeholder: t('contributionPlaceholder') },
  ] as const

  return (
    <div onKeyDown={handleKeyDown}>
      <h3 className="font-semibold text-gray-900 mb-0.5">{target.stageTitle}</h3>
      <p className="text-xs text-gray-500 mb-5">{t('subtitle')}</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {fields.map(({ key, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t(key)}
            </label>
            <textarea
              value={data[key]}
              onChange={(e) => onChange({ ...data, [key]: e.target.value })}
              placeholder={placeholder}
              rows={3}
              disabled={isSaving}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 resize-none focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors disabled:opacity-60"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          {tc('cancel')}
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              {t('saving')}
            </span>
          ) : (
            tc('save')
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Список этапов для студента ──
function StudentView({
  stages,
  myReflections,
  onOpenForm,
}: {
  stages: ProjectStage[]
  myReflections: Reflection[]
  onOpenForm: (target: FormTarget) => void
}) {
  const t = useTranslations('reflection')

  function isFilled(stageId: string | null) {
    return myReflections.some((r) =>
      stageId !== null ? r.stage_id === stageId : r.stage_id === null,
    )
  }

  const filledCount = myReflections.length
  const totalCount = stages.length + 1 // stages + general

  function StageRow({
    stageId,
    title,
    index,
  }: {
    stageId: string | null
    title: string
    index?: number
  }) {
    const filled = isFilled(stageId)
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {index !== undefined && (
              <span className="text-gray-400 mr-1.5">{index}.</span>
            )}
            {title}
          </p>
          <div className="mt-0.5">
            {filled ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 size={12} />
                {t('filled')}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Circle size={12} />
                {t('notFilled')}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onOpenForm({ stageId, stageTitle: title })}
          className={cn(
            'shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
            filled
              ? 'text-brand-600 hover:bg-brand-50 border border-brand-200'
              : 'bg-brand-600 text-white hover:bg-brand-700',
          )}
        >
          {filled ? t('edit') : t('fill')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Прогресс */}
      <div className="mb-4 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
        <p className="text-xs font-medium text-brand-700 mb-2">{t('progressLabel')}</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-brand-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{
                width: `${totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0}%`,
              }}
            />
          </div>
          <span className="text-xs font-semibold text-brand-700 shrink-0">
            {t('outOf', { filled: filledCount, total: totalCount })}
          </span>
        </div>
      </div>

      {/* Общая по проекту */}
      <StageRow stageId={null} title={t('generalProject')} />

      {/* Этапы */}
      {stages.map((stage, i) => (
        <StageRow key={stage.id} stageId={stage.id} title={stage.title} index={i + 1} />
      ))}
    </div>
  )
}

// ── Просмотр рефлексий преподавателем ──
function TeacherView({
  stages,
  students,
  byStudent,
  expandedStudent,
  viewingKey,
  onToggleStudent,
  onToggleViewing,
}: {
  stages: ProjectStage[]
  students: MemberWithProfile[]
  byStudent: Map<string, Map<string | null, ReflectionWithMeta>>
  expandedStudent: string | null
  viewingKey: string | null
  onToggleStudent: (id: string) => void
  onToggleViewing: (key: string) => void
}) {
  const t = useTranslations('reflection')

  const totalPerStudent = stages.length + 1

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="text-gray-200 mb-3" size={40} />
        <p className="text-sm text-gray-500">{t('emptyTeacher')}</p>
      </div>
    )
  }

  // All item definitions: general project first, then stages in order.
  const allItems = [
    { stageId: null as string | null, title: t('generalProject') },
    ...stages.map((s) => ({ stageId: s.id, title: s.title })),
  ]

  return (
    <div className="space-y-2">
      {students.map((student) => {
        const studentMap = byStudent.get(student.user_id) ?? new Map<string | null, ReflectionWithMeta>()
        const filled = studentMap.size
        const isExpanded = expandedStudent === student.user_id
        const name = student.full_name || student.email

        return (
          <div key={student.user_id} className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Строка студента */}
            <button
              onClick={() => onToggleStudent(student.user_id)}
              className="flex w-full items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm shrink-0 select-none">
                {(name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-500">
                  {t('outOf', { filled, total: totalPerStudent })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      filled === totalPerStudent && totalPerStudent > 0
                        ? 'bg-emerald-500'
                        : filled > 0
                        ? 'bg-amber-400'
                        : 'bg-gray-200',
                    )}
                    style={{
                      width: `${totalPerStudent > 0 ? Math.round((filled / totalPerStudent) * 100) : 0}%`,
                    }}
                  />
                </div>
                {isExpanded ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </div>
            </button>

            {/* Раскрытый список рефлексий по этапам */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-100 bg-gray-50/60">
                {allItems.map(({ stageId, title }, idx) => {
                  const reflection = studentMap.get(stageId)
                  const key = `${student.user_id}-${stageId ?? 'general'}`
                  const isViewing = viewingKey === key

                  return (
                    <div key={stageId ?? 'general'} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {reflection ? (
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        ) : (
                          <Circle size={14} className="text-gray-300 shrink-0" />
                        )}
                        <span className="flex-1 text-sm text-gray-700 truncate">
                          {idx > 0 && (
                            <span className="text-gray-400 mr-1">{idx}.</span>
                          )}
                          {title}
                        </span>
                        {reflection && (
                          <button
                            onClick={() => onToggleViewing(key)}
                            className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                          >
                            {isViewing ? t('hideContent') : t('viewContent')}
                          </button>
                        )}
                      </div>

                      {isViewing && reflection && (
                        <ReflectionContent reflection={reflection} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Содержимое одной рефлексии (только чтение, для преподавателя) ──
function ReflectionContent({ reflection }: { reflection: ReflectionWithMeta }) {
  const t = useTranslations('reflection')

  const items = [
    { label: t('whatDone'), value: reflection.what_done },
    { label: t('difficulties'), value: reflection.difficulties },
    { label: t('improvements'), value: reflection.improvements },
    { label: t('contribution'), value: reflection.contribution },
  ].filter((item) => item.value)

  if (items.length === 0) return null

  return (
    <div className="mt-3 space-y-2.5 pl-4 border-l-2 border-brand-100">
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
            {label}
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
        </div>
      ))}
    </div>
  )
}
