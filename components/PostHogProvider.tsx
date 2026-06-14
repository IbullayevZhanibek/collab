'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'

// Инициализируем PostHog один раз, только в браузере (никогда на сервере),
// чтобы не сломать SSR. Ключ и host берём из публичных env-переменных.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    // Автозахват кликов/сабмитов включён.
    autocapture: true,
    // Отключаем встроенный pageview-трекинг: в App Router он не ловит
    // клиентские переходы, поэтому считаем просмотры вручную (см. PostHogPageView).
    capture_pageview: false,
    capture_pageleave: true,
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      {/* useSearchParams требует Suspense-границу (иначе билд падает) */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}

// Отслеживаем смену страниц в App Router вручную: при изменении pathname
// или query-строки шлём событие $pageview.
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (!pathname || !ph) return

    let url = window.origin + pathname
    const search = searchParams.toString()
    if (search) url += '?' + search

    ph.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams, ph])

  return null
}
