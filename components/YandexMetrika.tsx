'use client'

import Script from 'next/script'
import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// ID счётчика вынесен в env для чистоты; значение по умолчанию — боевой счётчик.
export const YM_COUNTER_ID = Number(
  process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? 109836302
)

declare global {
  interface Window {
    ym?: (counterId: number, action: string, ...params: unknown[]) => void
  }
}

export function YandexMetrika() {
  return (
    <>
      {/*
        Загрузка через next/script со стратегией afterInteractive — скрипт
        инжектится на клиенте после гидрации, не блокируя SSR.
        IIFE из оригинального счётчика (с защитой от повторной вставки тега).
      */}
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YM_COUNTER_ID}', 'ym');
          ym(${YM_COUNTER_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, accurateTrackBounce:true, trackLinks:true});
        `}
      </Script>

      <noscript>
        <div>
          {/* Трекинг-пиксель внутри noscript: next/image тут неприменим. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YM_COUNTER_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>

      {/* useSearchParams требует Suspense-границу, иначе падает production-сборка */}
      <Suspense fallback={null}>
        <YandexMetrikaHits />
      </Suspense>
    </>
  )
}

// Метрика по умолчанию не ловит client-side переходы App Router,
// поэтому при каждой смене маршрута вручную отправляем 'hit'.
function YandexMetrikaHits() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Первый просмотр уже засчитан вызовом ym(..., 'init', ...),
  // поэтому пропускаем самый первый запуск, чтобы не задвоить хит.
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (typeof window.ym !== 'function') return

    const query = searchParams.toString()
    const url = pathname + (query ? `?${query}` : '')
    window.ym(YM_COUNTER_ID, 'hit', url)
  }, [pathname, searchParams])

  return null
}
