'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Превращает технические ошибки Supabase в понятные человеку фразы
 * на выбранном пользователем языке (через переводы auth.errors).
 */
async function humanizeAuthError(message: string): Promise<string> {
  const t = await getTranslations('auth.errors')
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return t('invalidCredentials')
  if (m.includes('email not confirmed')) return t('emailNotConfirmed')
  if (m.includes('user already registered') || m.includes('already been registered'))
    return t('alreadyRegistered')
  if (m.includes('password should be at least')) return t('passwordTooShort')
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return t('invalidEmail')
  if (m.includes('rate limit') || m.includes('too many')) return t('rateLimit')
  return t('generic')
}

export async function login(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: await humanizeAuthError(error.message) }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function register(
  email: string,
  password: string,
  fullName: string,
  globalRole: 'teacher' | 'student' = 'student',
) {
  const supabase = await createClient()

  // На прод-домене берём NEXT_PUBLIC_SITE_URL, локально — http://localhost:3000.
  // Ссылка подтверждения должна вести на /auth/callback, а не на корень сайта,
  // иначе код обмена сессии попадает на лендинг и не обрабатывается.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // global_role попадает в raw_user_meta_data и читается триггером
      // handle_new_user при создании строки profiles.
      data: { full_name: fullName, global_role: globalRole === 'teacher' ? 'teacher' : 'student' },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  // Явная ошибка от Supabase (на некоторых конфигурациях).
  if (error) {
    const m = error.message.toLowerCase()
    if (
      m.includes('user already registered') ||
      m.includes('already been registered') ||
      (error as unknown as { code?: string }).code === 'user_already_exists'
    ) {
      return { emailExists: true }
    }
    return { error: await humanizeAuthError(error.message) }
  }

  // Защита от enumeration-атак: Supabase не возвращает ошибку для уже
  // существующего email, но возвращает data.user с пустым массивом identities.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { emailExists: true }
  }

  // При включённом подтверждении email сессии ещё нет — нельзя редиректить на
  // /dashboard, иначе пользователя отбросит на /login. Просим проверить почту.
  if (!data.session) {
    return { needsConfirmation: true }
  }

  // Подтверждение выключено — сессия уже есть, ведём сразу в приложение.
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function loginWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
