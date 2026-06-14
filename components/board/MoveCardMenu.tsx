'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { MoreVertical, Check } from 'lucide-react'
import type { Column } from '@/lib/types'

interface MoveCardMenuProps {
  columns: Column[]
  currentColumnId: string
  onMove: (targetColumnId: string) => void
}

/**
 * Мобильная (и десктопная) альтернатива drag&drop: меню «Переместить в колонку».
 * Меню рендерится в портале с fixed-позиционированием, чтобы не обрезалось
 * горизонтальным скроллом доски. Закрывается по тапу вне меню, Escape и скроллу.
 */
export function MoveCardMenu({ columns, currentColumnId, onMove }: MoveCardMenuProps) {
  const t = useTranslations('board')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const MENU_WIDTH = 224 // w-56

  useEffect(() => {
    if (!open) return

    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
      setPos({ top: r.bottom + 6, left })
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    place()
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    // capture: ловим скролл любого контейнера (доска скроллится по X/Y)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        // stopPropagation на pointerdown — иначе dnd-kit начнёт перетаскивание
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        title={t('moveTo')}
        aria-label={t('moveTo')}
        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-all flex-shrink-0"
      >
        <MoreVertical size={14} />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed z-[60] max-h-[60vh] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-pop py-1"
          >
            <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-gray-400">
              {t('moveTo')}
            </p>
            {columns.map((col) => {
              const isCurrent = col.id === currentColumnId
              return (
                <button
                  key={col.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => {
                    onMove(col.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 min-h-11 px-3 text-sm text-left transition-colors ${
                    isCurrent
                      ? 'text-gray-400 cursor-default'
                      : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  <span className="truncate">{col.title}</span>
                  {isCurrent && <Check size={15} className="shrink-0 text-brand-500" />}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
