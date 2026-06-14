'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

interface PostHogIdentifyProps {
  userId: string
  email: string
  name: string
}

// Связывает текущую PostHog-сессию с залогиненным пользователем.
// Рендерится в dashboard layout, где пользователь гарантированно авторизован.
// Сброс (posthog.reset) выполняется при выходе — см. кнопку «Выйти» в Sidebar.
export function PostHogIdentify({ userId, email, name }: PostHogIdentifyProps) {
  const ph = usePostHog()

  useEffect(() => {
    if (!ph || !userId) return
    ph.identify(userId, { email, name })
  }, [ph, userId, email, name])

  return null
}
