import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Палитра для иконок досок: мягкие пастельные плашки + контрастная иконка.
// Классы заданы литералами целиком — иначе Tailwind вырежет их при сборке.
export type BoardColor = { bg: string; icon: string; hoverBg: string }

const BOARD_COLORS: BoardColor[] = [
  { bg: 'bg-violet-100', icon: 'text-violet-600', hoverBg: 'group-hover:bg-violet-600' },
  { bg: 'bg-blue-100', icon: 'text-blue-600', hoverBg: 'group-hover:bg-blue-600' },
  { bg: 'bg-emerald-100', icon: 'text-emerald-600', hoverBg: 'group-hover:bg-emerald-600' },
  { bg: 'bg-orange-100', icon: 'text-orange-600', hoverBg: 'group-hover:bg-orange-600' },
  { bg: 'bg-pink-100', icon: 'text-pink-600', hoverBg: 'group-hover:bg-pink-600' },
  { bg: 'bg-teal-100', icon: 'text-teal-600', hoverBg: 'group-hover:bg-teal-600' },
  { bg: 'bg-indigo-100', icon: 'text-indigo-600', hoverBg: 'group-hover:bg-indigo-600' },
  { bg: 'bg-red-100', icon: 'text-red-600', hoverBg: 'group-hover:bg-red-600' },
]

/**
 * Детерминированный цвет доски по строке-сидy (id или названию):
 * одинаковый сид → всегда один и тот же цвет из палитры.
 */
export function getBoardColor(seed: string): BoardColor {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return BOARD_COLORS[hash % BOARD_COLORS.length]
}

// Казахские названия месяцев (номинатив). Intl.DateTimeFormat('kk') выдаёт
// артефакт "M06" для числового и краткого формата — поэтому подставляем вручную.
const KK_MONTHS_LONG = [
  'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан',
]
const KK_MONTHS_SHORT = [
  'қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау',
  'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел',
]

function toDate(dateStr: string): Date {
  return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
}

/** Полный формат с годом: "22 маусым 2026 ж." / "22 июня 2026 г." / "Jun 22, 2026" */
export function formatDate(dateStr: string, locale: string): string {
  const d = toDate(dateStr)
  if (locale === 'kk') {
    return `${d.getDate()} ${KK_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()} ж.`
  }
  return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: locale === 'ru' ? 'long' : 'short',
    year: 'numeric',
  })
}

/** Короткий формат без года: "22 мау" / "22 июня" / "Jun 22" */
export function formatDateShort(dateStr: string, locale: string): string {
  const d = toDate(dateStr)
  if (locale === 'kk') {
    return `${d.getDate()} ${KK_MONTHS_SHORT[d.getMonth()]}`
  }
  return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: locale === 'ru' ? 'long' : 'short',
  })
}

/**
 * Относительное время на выбранном языке: «только что», «5 минут назад» и т.п.
 * `justNow` передаётся из переводов, остальное форматирует Intl по локали.
 */
export function formatRelativeTime(
  date: string | Date,
  locale: string = 'ru',
  justNow: string = 'только что'
): string {
  const then = new Date(date).getTime()
  const diffSec = Math.round((then - Date.now()) / 1000)
  const absSec = Math.abs(diffSec)

  if (absSec < 45) return justNow

  const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

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
