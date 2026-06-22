'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle2, Circle, CircleDot, Flag } from 'lucide-react'
import { updateStageStatus } from '@/actions/stages'
import { cn, formatDateShort } from '@/lib/utils'
import type { ProjectStage, ProjectStageStatus } from '@/lib/types'

interface ProjectStagesProps {
  boardId: string
  stages: ProjectStage[]
  isOwner: boolean
}

const STATUS_ICON: Record<ProjectStageStatus, typeof Circle> = {
  pending: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
}

const STATUS_COLOR: Record<ProjectStageStatus, string> = {
  pending: 'text-gray-400',
  in_progress: 'text-amber-500',
  done: 'text-emerald-500',
}

// Циклическое переключение статуса по клику: pending → in_progress → done → pending.
const NEXT: Record<ProjectStageStatus, ProjectStageStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
}

export function ProjectStages({ boardId, stages, isOwner }: ProjectStagesProps) {
  const t = useTranslations('stages')
  const locale = useLocale()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (stages.length === 0) return null

  function toggle(stage: ProjectStage) {
    if (!isOwner) return
    setBusyId(stage.id)
    startTransition(async () => {
      await updateStageStatus(stage.id, boardId, NEXT[stage.status], stage.title)
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Flag size={16} className="text-brand-500" />
        <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
        <span className="text-xs text-gray-400">{t('count', { count: stages.length })}</span>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage, i) => {
          const Icon = STATUS_ICON[stage.status]
          return (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => toggle(stage)}
                disabled={!isOwner || busyId === stage.id}
                title={isOwner ? t('toggleHint') : undefined}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-left transition-colors',
                  isOwner && 'hover:border-brand-200 hover:bg-brand-50/40 cursor-pointer',
                  !isOwner && 'cursor-default',
                  busyId === stage.id && 'opacity-50'
                )}
              >
                <Icon size={18} className={cn('mt-0.5 shrink-0', STATUS_COLOR[stage.status])} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 truncate">
                    <span className="text-gray-400 mr-1">{i + 1}.</span>
                    {stage.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className={STATUS_COLOR[stage.status]}>{t(`status.${stage.status}`)}</span>
                    {stage.due_date && (
                      <span className="text-gray-400">· {formatDateShort(stage.due_date, locale)}</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
