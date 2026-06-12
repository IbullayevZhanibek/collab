'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LayoutDashboard } from 'lucide-react'

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
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 rounded-xl p-2">
              <LayoutDashboard className="text-white" size={22} />
            </div>
            <span className="text-xl font-bold text-gray-900">Collab</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Добро пожаловать</h1>
        <p className="text-center text-gray-500 text-sm mb-8">Войдите в свой аккаунт</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
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
          Нет аккаунта?{' '}
          <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
