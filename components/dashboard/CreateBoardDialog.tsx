'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { usePostHog } from 'posthog-js/react'
import { Plus, Trash2 } from 'lucide-react'
import { createBoard } from '@/actions/boards'
import { applyStandardRubric } from '@/actions/grading'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { StageDraft } from '@/lib/types'

interface CreateBoardDialogProps {
  open: boolean
  onClose: () => void
}

const emptyStage = (): StageDraft => ({ title: '', due_date: null })

export function CreateBoardDialog({ open, onClose }: CreateBoardDialogProps) {
  const t = useTranslations('dialogs.createBoard')
  const tc = useTranslations('common')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [expectedResult, setExpectedResult] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [defenseFormat, setDefenseFormat] = useState('')
  const [stages, setStages] = useState<StageDraft[]>([])
  const [withStandardRubric, setWithStandardRubric] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const posthog = usePostHog()

  function reset() {
    setTitle('')
    setDescription('')
    setGoal('')
    setExpectedResult('')
    setStartDate('')
    setEndDate('')
    setDefenseFormat('')
    setStages([])
    setWithStandardRubric(true)
    setError(null)
  }

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function handleCreate() {
    if (!title.trim()) {
      setError(t('errorEmpty'))
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createBoard({
        title: title.trim(),
        description,
        goal,
        expected_result: expectedResult,
        start_date: startDate || null,
        end_date: endDate || null,
        defense_format: defenseFormat,
        stages: stages.filter((s) => s.title.trim()),
      })
      if (result?.error) {
        setError(result.error)
      } else {
        posthog.capture('project_created', { board_id: result?.data?.id })
        // Опционально сразу создаём стандартную рубрику оценивания.
        if (withStandardRubric && result?.data?.id) {
          await applyStandardRubric(result.data.id)
        }
        reset()
        onClose()
      }
    })
  }

  function handleClose() {
    reset()
    onClose()
  }

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'

  return (
    <Dialog open={open} onClose={handleClose} title={t('title')} className="sm:max-w-xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
        <div>
          <label className={labelCls}>{t('label')}</label>
          <Input
            placeholder={t('placeholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>{t('descriptionLabel')}</label>
          <Textarea
            placeholder={t('descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>{t('goalLabel')}</label>
          <Textarea
            placeholder={t('goalPlaceholder')}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>{t('expectedResultLabel')}</label>
          <Textarea
            placeholder={t('expectedResultPlaceholder')}
            value={expectedResult}
            onChange={(e) => setExpectedResult(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('startDateLabel')}</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('endDateLabel')}</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('defenseFormatLabel')}</label>
          <Input
            placeholder={t('defenseFormatPlaceholder')}
            value={defenseFormat}
            onChange={(e) => setDefenseFormat(e.target.value)}
          />
        </div>

        {/* Этапы проекта */}
        <div>
          <label className={labelCls}>{t('stagesLabel')}</label>
          <div className="space-y-2">
            {stages.map((stage, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input
                  className="flex-1"
                  placeholder={t('stageTitlePlaceholder')}
                  value={stage.title}
                  onChange={(e) => updateStage(i, { title: e.target.value })}
                />
                <Input
                  type="date"
                  className="w-40 shrink-0"
                  value={stage.due_date ?? ''}
                  onChange={(e) => updateStage(i, { due_date: e.target.value || null })}
                />
                <button
                  type="button"
                  onClick={() => setStages((prev) => prev.filter((_, idx) => idx !== i))}
                  title={t('stageRemove')}
                  className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStages((prev) => [...prev, emptyStage()])}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <Plus size={15} />
            {t('stageAdd')}
          </button>
        </div>

        {/* Опция: сразу создать стандартную рубрику оценивания */}
        <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors">
          <input
            type="checkbox"
            checked={withStandardRubric}
            onChange={(e) => setWithStandardRubric(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500/30 accent-brand-600"
          />
          <span className="text-sm text-gray-700">{t('standardRubric')}</span>
        </label>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <Button variant="outline" onClick={handleClose} disabled={isPending}>
          {tc('cancel')}
        </Button>
        <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
          {isPending ? tc('creating') : tc('create')}
        </Button>
      </div>
    </Dialog>
  )
}
