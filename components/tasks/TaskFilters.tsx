'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, X } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function TaskFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('tasks')
  const tp = useTranslations('priority')
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)

  const priority = searchParams.get('priority') ?? ''
  const boardId = searchParams.get('board') ?? ''
  const view = searchParams.get('view') ?? 'list'
  const hasFilters = !!(priority || boardId)

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    startTransition(() => router.push(`/tasks?${params.toString()}`))
  }

  function clearFilters() {
    const params = new URLSearchParams()
    if (view !== 'list') params.set('view', view)
    startTransition(() => router.push(`/tasks?${params.toString()}`))
    setExpanded(false)
  }

  return (
    <div>
      {/* Mobile toggle */}
      <div className="flex items-center gap-2 sm:hidden mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className={cn(hasFilters && 'border-brand-400 text-brand-700')}
        >
          <SlidersHorizontal size={14} className="mr-1.5" />
          {t('filters')}
          {hasFilters && (
            <span className="ml-1.5 bg-brand-100 text-brand-700 rounded-full text-xs px-1.5 py-0.5 leading-none">
              1
            </span>
          )}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={14} className="mr-1" />
            {t('clear')}
          </Button>
        )}
      </div>

      {/* Filter controls — always visible on sm+, toggleable on mobile */}
      <div className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap',
        !expanded && 'hidden sm:flex'
      )}>
        <Select
          value={priority}
          onChange={(e) => updateFilter('priority', e.target.value)}
          className="w-full sm:w-44"
          disabled={isPending}
        >
          <option value="" className="text-gray-900">{tp('all')}</option>
          <option value="low" className="text-gray-900">{tp('low')}</option>
          <option value="medium" className="text-gray-900">{tp('medium')}</option>
          <option value="high" className="text-gray-900">{tp('high')}</option>
          <option value="critical" className="text-gray-900">{tp('critical')}</option>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="hidden sm:flex">
            <X size={14} className="mr-1" />
            {t('clear')}
          </Button>
        )}
      </div>
    </div>
  )
}
