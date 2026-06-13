import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const relativeTime = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })

/** Относительное время по-русски: «только что», «5 минут назад», «2 часа назад». */
export function formatRelativeTime(date: string | Date): string {
  const then = new Date(date).getTime()
  const diffSec = Math.round((then - Date.now()) / 1000)
  const absSec = Math.abs(diffSec)

  if (absSec < 45) return 'только что'

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [unit, secondsInUnit] of units) {
    if (absSec >= secondsInUnit) {
      return relativeTime.format(Math.round(diffSec / secondsInUnit), unit)
    }
  }
  return relativeTime.format(Math.round(diffSec / 60), 'minute')
}
