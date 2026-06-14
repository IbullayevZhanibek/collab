'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { Check, Globe } from 'lucide-react'
import { locales, LOCALE_COOKIE, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

const SHORT_LABEL: Record<Locale, string> = {
  ru: 'РУ',
  kk: 'ҚАЗ',
  en: 'EN',
}

const FULL_LABEL: Record<Locale, string> = {
  ru: 'Русский',
  kk: 'Қазақша',
  en: 'English',
}

interface LanguageSwitcherProps {
  /** На лендинге фон светлый — компактная рамка; в сайдбаре — на всю ширину. */
  variant?: 'compact' | 'block'
  className?: string
}

export function LanguageSwitcher({ variant = 'compact', className }: LanguageSwitcherProps) {
  const active = useLocale() as Locale
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(locale: Locale) {
    // Год хранения cookie, доступна на всех путях. После смены — перезагрузка,
    // чтобы серверные компоненты перерисовались с новой локалью. Запись cookie —
    // намеренный побочный эффект обработчика клика.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
    setOpen(false)
    if (locale !== active) window.location.reload()
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors',
          variant === 'block' ? 'w-full justify-center h-9 px-3' : 'h-9 px-3'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={15} className="shrink-0" />
        <span>{SHORT_LABEL[active]}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute right-0 z-50 mt-1 min-w-[10rem] rounded-xl border border-gray-200 bg-white shadow-pop py-1',
            variant === 'block' && 'left-0 bottom-full mb-1 mt-0'
          )}
        >
          {locales.map((locale) => {
            const isActive = locale === active
            return (
              <button
                key={locale}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => choose(locale)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-left transition-colors',
                  isActive ? 'text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>
                  <span className="inline-block w-9 text-gray-400">{SHORT_LABEL[locale]}</span>
                  {FULL_LABEL[locale]}
                </span>
                {isActive && <Check size={15} className="shrink-0 text-brand-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
