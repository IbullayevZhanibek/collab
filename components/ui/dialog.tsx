'use client'

import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
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

  if (!open) return null

  return createPortal(
    /* Mobile: sheet slides up from bottom. sm+: centered modal. */
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        className={cn(
          'relative z-50 w-full bg-white shadow-2xl',
          /* Mobile: no top radius, no max-width, scrollable */
          'rounded-t-2xl max-h-[92dvh] overflow-y-auto',
          /* sm+: centered card with rounded corners */
          'sm:rounded-xl sm:max-w-md',
          'p-5 sm:p-6',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle visible only on mobile */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-300" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
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
