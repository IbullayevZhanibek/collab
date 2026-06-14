'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MailCheck } from 'lucide-react'
import { register } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/ui/logo'

export default function RegisterPage() {
  const t = useTranslations('auth.register')
  const tv = useTranslations('auth.validation')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRegister() {
    setError(null)
    if (!fullName || !email || !password) {
      setError(tv('fillAll'))
      return
    }
    if (password.length < 6) {
      setError(tv('passwordMin'))
      return
    }
    startTransition(async () => {
      const result = await register(email, password, fullName)
      if (result?.error) {
        setError(result.error)
      } else if (result?.needsConfirmation) {
        setSentTo(email)
      }
    })
  }

  if (sentTo) {
    return (
      <div className="w-full">
        <div className="bg-white rounded-3xl shadow-pop border border-gray-100 p-8 text-center">
          <div className="flex justify-center mb-6">
            <Logo size={40} withWordmark wordmarkClassName="text-2xl" />
          </div>

          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <MailCheck size={28} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkEmailTitle')}</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {t.rich('checkEmailBody', {
              email: sentTo,
              b: (chunks) => <span className="font-semibold text-gray-900">{chunks}</span>,
            })}
          </p>

          <div className="mt-6 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-500">
            {t('checkSpam')}
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            {t('confirmedAlready')}{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-semibold">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-3xl shadow-pop border border-gray-100 p-8">
        <div className="flex justify-center mb-6">
          <Logo size={40} withWordmark wordmarkClassName="text-2xl" />
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-center text-gray-500 text-sm mb-8">
          {t('subtitle')}
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('name')}</label>
            <Input
              type="text"
              placeholder={t('namePlaceholder')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('email')}</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('password')}</label>
            <Input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            />
          </div>

          <Button
            onClick={handleRegister}
            disabled={isPending}
            size="lg"
            className="w-full"
          >
            {isPending ? t('submitting') : t('submit')}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          {t('haveAccount')}{' '}
          <Link href="/login" className="text-brand-600 hover:text-brand-700 font-semibold">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
