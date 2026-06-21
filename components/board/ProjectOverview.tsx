'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ChevronDown, Target, Trophy, CalendarRange, ShieldCheck, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Board } from '@/lib/types'

interface ProjectOverviewProps {
  board: Board
}

export function ProjectOverview({ board }: ProjectOverviewProps) {
  const t = useTranslations('projectOverview')
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  const hasMeta =
    board.description ||
    board.goal ||
    board.expected_result ||
    board.start_date ||
    board.end_date ||
    board.defense_format

  if (!hasMeta) return null

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  const dateRange =
    board.start_date || board.end_date
      ? [board.start_date && formatDate(board.start_date), board.end_date && formatDate(board.end_date)]
          .filter(Boolean)
          .join(' — ')
      : null

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Info size={16} className="text-brand-500 shrink-0" />
        <h2 className="text-sm font-semibold text-gray-900 flex-1">{t('title')}</h2>
        <ChevronDown size={18} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-4 space-y-4 text-sm">
          {board.description && (
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{board.description}</p>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            {board.goal && (
              <Field icon={Target} label={t('goal')} value={board.goal} />
            )}
            {board.expected_result && (
              <Field icon={Trophy} label={t('expectedResult')} value={board.expected_result} />
            )}
            {dateRange && (
              <Field icon={CalendarRange} label={t('dates')} value={dateRange} />
            )}
            {board.defense_format && (
              <Field icon={ShieldCheck} label={t('defenseFormat')} value={board.defense_format} />
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target
  label: string
  value: string
}) {
  return (
    <div className="flex gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-gray-400">{label}</dt>
        <dd className="text-gray-700 whitespace-pre-wrap break-words">{value}</dd>
      </div>
    </div>
  )
}
