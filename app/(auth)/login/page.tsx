'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/ui/logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleLogin() {
    setError(null)
    if (!email || !password) {
      setError('Заполните все поля')
      return
    }
    startTransition(async () => {
      const result = await login(email, password)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-3xl shadow-pop border border-gray-100 p-8">
        <div className="flex justify-center mb-6">
          <Logo size={40} withWordmark wordmarkClassName="text-2xl" />
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">С возвращением 👋</h1>
        <p className="text-center text-gray-500 text-sm mb-8">
          Войдите, чтобы продолжить работу над проектами
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <Button
            onClick={handleLogin}
            disabled={isPending}
            size="lg"
            className="w-full"
          >
            {isPending ? 'Вход...' : 'Войти'}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Ещё нет аккаунта?{' '}
          <Link href="/register" className="text-brand-600 hover:text-brand-700 font-semibold">
            Создать бесплатно
          </Link>
        </p>
      </div>
    </div>
  )
}
