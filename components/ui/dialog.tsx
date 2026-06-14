'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  /** Не фокусировать первое поле автоматически при открытии. */
  disableAutoFocus?: boolean
}

export function Dialog({ open, onClose, title, children, className, disableAutoFocus }: DialogProps) {
  const tc = useTranslations('common')
  // Внешний flex-контейнер (overlay) и сама панель — нужны для подгонки под
  // видимую область при появлении экранной клавиатуры.
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  // Фокус откладываем до завершения анимации открытия (dialog-in ≈ 0.2s).
  // Мгновенный autoFocus на мобильных всплывает клавиатуру ещё до того, как
  // bottom-sheet встал на место, и панель оказывается под клавиатурой.
  useEffect(() => {
    if (!open || disableAutoFocus) return
    const t = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const field = panel.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea, select'
      )
      if (!field) return
      field.focus()
      // Подстраховка: гарантированно показываем поле над клавиатурой.
      field.scrollIntoView({ block: 'center' })
    }, 250)
    return () => window.clearTimeout(t)
  }, [open, disableAutoFocus])

  // Когда появляется клавиатура, visualViewport сжимается. Привязываем overlay
  // к видимой области (height + top по visualViewport), чтобы bottom-sheet
  // "прилипал" к верху клавиатуры, а не уходил под неё. Панель не может стать
  // выше видимой области — внутри неё работает overflow-y-auto.
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return

    const apply = () => {
      const container = containerRef.current
      const panel = panelRef.current
      if (container) {
        container.style.height = `${vv.height}px`
        container.style.top = `${vv.offsetTop}px`
        container.style.bottom = 'auto'
      }
      if (panel) {
        panel.style.maxHeight = `${vv.height}px`
      }
    }

    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    /* Mobile: sheet slides up from bottom. sm+: centered modal. */
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        ref={panelRef}
        className={cn(
          'relative z-50 w-full bg-white shadow-pop animate-dialog-in',
          /* Mobile: no top radius, no max-width, scrollable */
          'rounded-t-3xl max-h-[92dvh] overflow-y-auto overscroll-contain',
          /* sm+: centered card with rounded corners */
          'sm:rounded-2xl sm:max-w-md',
          'p-5 pt-6 sm:p-6',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle visible only on mobile */}
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-300" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label={tc('close')}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  )
}
