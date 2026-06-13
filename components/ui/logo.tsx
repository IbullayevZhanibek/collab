'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  /** Размер иконки в пикселях */
  size?: number
  /** Показать текст «Collab» рядом с иконкой */
  withWordmark?: boolean
  className?: string
  wordmarkClassName?: string
}

/**
 * Фирменный знак Collab.
 * Иконка — три карточки канбан-доски, выстроенные «лесенкой» прогресса,
 * символизирующие движение задач от идеи к готовому результату.
 */
export function Logo({
  size = 32,
  withWordmark = false,
  className,
  wordmarkClassName,
}: LogoProps) {
  // Уникальный id градиента на каждый экземпляр логотипа.
  // Логотип рендерится несколько раз (мобильная шапка, мобильное меню,
  // десктоп-сайдбар). С одинаковым id градиенты конфликтуют, а тот, что
  // объявлен внутри скрытого (display:none) SVG, перестаёт быть источником
  // заливки для видимого — и иконка превращается в пустой белый квадрат.
  const gradId = useId()
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#818cf8" />
            <stop offset="0.55" stopColor="#6366f1" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        {/* Скруглённая плашка-бренд */}
        <rect width="32" height="32" rx="9" fill={`url(#${gradId})`} />
        {/* Три «карточки» возрастающей готовности */}
        <rect x="7.5" y="8" width="4.5" height="16" rx="2.25" fill="#fff" />
        <rect x="13.75" y="8" width="4.5" height="11" rx="2.25" fill="#fff" fillOpacity="0.82" />
        <rect x="20" y="8" width="4.5" height="6.5" rx="2.25" fill="#fff" fillOpacity="0.62" />
      </svg>

      {withWordmark && (
        <span
          className={cn(
            'font-bold tracking-tight text-gray-900 text-lg leading-none',
            wordmarkClassName
          )}
        >
          Collab
        </span>
      )}
    </span>
  )
}
