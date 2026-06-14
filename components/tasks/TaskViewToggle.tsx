'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { List, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TaskViewToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('tasks')
  const [isPending, startTransition] = useTransition()

  const view = searchParams.get('view') ?? 'list'

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    startTransition(() => {
      router.push(`/tasks?${params.toString()}`)
    })
  }

  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setView('list')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
          view === 'list'
            ? 'bg-brand-600 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50'
        )}
      >
        <List size={15} />
        {t('viewList')}
      </button>
      <button
        onClick={() => setView('kanban')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
          view === 'kanban'
            ? 'bg-brand-600 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50'
        )}
      >
        <LayoutGrid size={15} />
        {t('viewKanban')}
      </button>
    </div>
  )
}
