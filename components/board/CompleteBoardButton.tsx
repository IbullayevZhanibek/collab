'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, RotateCcw, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { completeBoard, reopenBoard } from '@/actions/boards'

interface CompleteBoardButtonProps {
  boardId: string
  boardTitle: string
  initialStatus: 'active' | 'completed'
}

export function CompleteBoardButton({
  boardId,
  boardTitle,
  initialStatus,
}: CompleteBoardButtonProps) {
  const t = useTranslations('board')
  const [status, setStatus] = useState(initialStatus)
  const [isPending, startTransition] = useTransition()

  function handleComplete() {
    if (!confirm(t('completeConfirm', { title: boardTitle }))) return
    setStatus('completed')
    startTransition(async () => {
      const res = await completeBoard(boardId)
      if (res?.error) setStatus('active')
    })
  }

  function handleReopen() {
    if (!confirm(t('reopenConfirm', { title: boardTitle }))) return
    setStatus('active')
    startTransition(async () => {
      const res = await reopenBoard(boardId)
      if (res?.error) setStatus('completed')
    })
  }

  if (status === 'completed') {
    return (
      <>
        {/* "Завершён" badge — hidden on very small screens to save space */}
        <span className="hidden md:inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 shrink-0">
          <Check size={11} />
          {t('completed')}
        </span>
        {/* Reopen button */}
        <button
          onClick={handleReopen}
          disabled={isPending}
          title={t('reopen')}
          className={cn(
            'inline-flex items-center gap-2 h-9 px-2 sm:px-3 rounded-lg border transition-colors text-sm shrink-0 disabled:opacity-50',
            'border-gray-200 bg-white hover:bg-gray-50 text-gray-600',
          )}
        >
          {isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RotateCcw size={15} className="shrink-0" />
          )}
          <span className="hidden sm:inline">{t('reopen')}</span>
        </button>
      </>
    )
  }

  return (
    <button
      onClick={handleComplete}
      disabled={isPending}
      title={t('complete')}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-2 sm:px-3 rounded-lg border transition-colors text-sm shrink-0 disabled:opacity-50',
        'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
      )}
    >
      {isPending ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <CheckCircle2 size={15} className="shrink-0" />
      )}
      <span className="hidden sm:inline">{t('complete')}</span>
    </button>
  )
}
