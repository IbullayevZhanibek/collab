'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ListTodo, Calendar, Mail, Timer, LogOut, Menu, X } from 'lucide-react'
import posthog from 'posthog-js'
import { logout } from '@/actions/auth'
import { Logo } from '@/components/ui/logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

interface SidebarProps {
  displayName: string
  initials: string
  email: string
  invitationCount: number
  globalRole: 'teacher' | 'student'
}

const NAV = [
  { href: '/dashboard', key: 'boards', Icon: LayoutDashboard },
  { href: '/tasks', key: 'tasks', Icon: ListTodo },
  { href: '/pomodoro', key: 'pomodoro', Icon: Timer },
  { href: '/calendar', key: 'calendar', Icon: Calendar },
  { href: '/invitations', key: 'invitations', Icon: Mail },
] as const

function navClass(active: boolean) {
  return cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
    active
      ? 'bg-brand-50 text-brand-700'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  )
}

export function Sidebar({ displayName, initials, email, invitationCount, globalRole }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('nav')
  const tr = useTranslations('roles')

  const roleBadge = (
    <span
      className={cn(
        'mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        globalRole === 'teacher' ? 'bg-brand-100 text-brand-700' : 'bg-emerald-100 text-emerald-700'
      )}
    >
      {globalRole === 'teacher' ? tr('teacher') : tr('student')}
    </span>
  )

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  // Бейдж-счётчик pending-приглашений рядом с пунктом «Приглашения».
  const badgeFor = (href: string) =>
    href === '/invitations' && invitationCount > 0 ? invitationCount : null

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <Link href="/dashboard">
          <Logo size={28} withWordmark wordmarkClassName="text-base" />
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label={t('openMenu')}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* ── Mobile backdrop — only rendered when drawer is open, hidden on md+ ── */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-40 w-72 bg-white flex flex-col shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            <Logo size={28} withWordmark wordmarkClassName="text-base" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label={t('closeMenu')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ href, key, Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={navClass(isActive(href))}>
              <Icon size={18} />
              <span className="flex-1">{t(key)}</span>
              {badgeFor(href) && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold tabular-nums">
                  {badgeFor(href)}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
              {roleBadge}
            </div>
          </div>
          <LanguageSwitcher variant="block" className="mb-2" />
          <form action={logout}>
            <button type="submit" onClick={() => posthog.reset()} className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <LogOut size={16} />
              {t('logout')}
            </button>
          </form>
        </div>
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-10">
        <div className="h-16 px-5 flex items-center border-b border-gray-200 shrink-0">
          <Link href="/dashboard">
            <Logo size={30} withWordmark />
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ href, key, Icon }) => (
            <Link key={href} href={href} className={navClass(isActive(href))}>
              <Icon size={18} />
              <span className="flex-1">{t(key)}</span>
              {badgeFor(href) && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold tabular-nums">
                  {badgeFor(href)}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
              {roleBadge}
            </div>
          </div>
          <LanguageSwitcher variant="block" className="mb-2" />
          <form action={logout}>
            <button type="submit" onClick={() => posthog.reset()} className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <LogOut size={16} />
              {t('logout')}
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
