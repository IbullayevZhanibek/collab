'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Подхватывает результат подтверждения email/OAuth, если ссылка привела на корень
 * сайта, а не на /auth/callback. Покрывает два формата, которые присылает Supabase:
 *
 *  1. PKCE-флоу — код в query: `/?code=...`
 *  2. Implicit-флоу — токены в hash: `/#access_token=...&refresh_token=...`
 *
 * Hash не доходит до сервера, поэтому разобрать его можно только на клиенте.
 * После установки сессии чистим URL и уводим пользователя на /dashboard.
 */
export function AuthRedirectHandler() {
  const router = useRouter()

  useEffect(() => {
    const { search, hash } = window.location
    const supabase = createClient()

    const code = new URLSearchParams(search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          window.history.replaceState(null, '', window.location.pathname)
          router.replace('/dashboard')
        }
      })
      return
    }

    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.slice(1))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) {
            window.history.replaceState(null, '', window.location.pathname)
            router.replace('/dashboard')
          }
        })
      }
    }
  }, [router])

  return null
}
