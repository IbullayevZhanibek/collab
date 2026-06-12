'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ListTodo, LogOut, Menu, X } from 'lucide-react'
import { logout } from '@/actions/auth'

interface SidebarProps {
  displayName: string
  initials: string
  email: string
}

const NAV = [
  { href: '/dashboard', label: 'Доски', Icon: LayoutDashboard },
  { href: '/tasks', label: 'Мои задачи', Icon: ListTodo },
] as const

function navClass(active: boolean) {
  return cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
    active
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
  )
}

export function Sidebar({ displayName, initials, email }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="bg-indigo-600 rounded-lg p-1.5">
            <LayoutDashboard className="text-white" size={16} />
          </div>
          <span className="font-bold text-gray-900">Collab</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Открыть меню"
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
          <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2">
            <div className="bg-indigo-600 rounded-lg p-1.5">
              <LayoutDashboard className="text-white" size={16} />
            </div>
            <span className="font-bold text-gray-900">Collab</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={navClass(isActive(href))}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <LogOut size={16} />
              Выйти
            </button>
          </form>
        </div>
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-10">
        <div className="p-5 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="bg-indigo-600 rounded-lg p-1.5">
              <LayoutDashboard className="text-white" size={18} />
            </div>
            <span className="font-bold text-gray-900 text-lg">Collab</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={navClass(isActive(href))}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <LogOut size={16} />
              Выйти
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
