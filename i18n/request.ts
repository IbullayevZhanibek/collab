import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, isLocale, LOCALE_COOKIE } from './config'

// Без i18n-routing: локаль берём из cookie NEXT_LOCALE (по умолчанию 'ru').
// URL не содержит префикса языка — структура роутов остаётся прежней.
export default getRequestConfig(async () => {
  const store = await cookies()
  const candidate = store.get(LOCALE_COOKIE)?.value
  const locale = isLocale(candidate) ? candidate : defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
