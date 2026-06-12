'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Превращает технические ошибки Supabase в понятные человеку фразы на русском. */
function humanizeAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials'))
    return 'Неверный email или пароль. Проверьте данные и попробуйте снова.'
  if (m.includes('email not confirmed'))
    return 'Email ещё не подтверждён. Загляните в почту и перейдите по ссылке из письма.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Аккаунт с таким email уже существует. Попробуйте войти.'
  if (m.includes('password should be at least'))
    return 'Пароль слишком короткий — нужно минимум 6 символов.'
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Похоже, в email опечатка. Проверьте адрес.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Слишком много попыток. Немного подождите и попробуйте снова.'
  return 'Что-то пошло не так. Попробуйте ещё раз через минуту.'
}

export async function login(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: humanizeAuthError(error.message) }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function register(email: string, password: string, fullName: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    return { error: humanizeAuthError(error.message) }
  }

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
