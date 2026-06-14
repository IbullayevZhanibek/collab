// Единый источник правды по локалям приложения.
// localePrefix: 'never' — язык хранится в cookie NEXT_LOCALE, в URL не попадает,
// поэтому текущие роуты и Supabase redirect URLs не меняются.
export const locales = ['ru', 'kk', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'ru'

export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}
