import Link from 'next/link'
import { LayoutDashboard, Kanban, CheckSquare, Paperclip } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Nav ── */}
      <nav className="border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500 rounded-xl p-1.5">
            <LayoutDashboard className="text-white" size={20} />
          </div>
          <span className="font-bold text-gray-900 text-lg">Collab</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Начать бесплатно
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="px-4 sm:px-8 pt-20 pb-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span>✦</span>
            <span>Бесплатно для студентов</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight max-w-3xl">
            Совместная работа
            <span className="text-indigo-500"> для студентов</span>
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-gray-500 max-w-xl leading-relaxed">
            Бесплатный инструмент для командных проектов — канбан доски, задачи и файлы в одном месте.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-colors shadow-md shadow-indigo-100"
            >
              Начать бесплатно
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold px-7 py-3.5 rounded-xl text-base transition-colors"
            >
              Войти в аккаунт
            </Link>
          </div>

          {/* Preview card */}
          <div className="mt-16 w-full max-w-2xl bg-gray-50 border border-gray-200 rounded-2xl p-5 text-left shadow-sm">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-300" />
              <div className="w-3 h-3 rounded-full bg-yellow-300" />
              <div className="w-3 h-3 rounded-full bg-green-300" />
            </div>
            <div className="flex gap-3 overflow-hidden">
              {[
                { title: 'К выполнению', color: 'bg-gray-200', cards: ['Дизайн главной', 'API авторизации'] },
                { title: 'В работе', color: 'bg-indigo-200', cards: ['Мобильная вёрстка', 'Тесты'] },
                { title: 'Готово', color: 'bg-green-200', cards: ['Бэкенд БД', 'CI/CD'] },
              ].map((col) => (
                <div key={col.title} className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold px-2 py-1 rounded-md mb-2 ${col.color} text-gray-700 w-fit`}>
                    {col.title}
                  </div>
                  <div className="space-y-2">
                    {col.cards.map((card) => (
                      <div key={card} className="bg-white rounded-lg px-3 py-2 text-xs text-gray-700 border border-gray-100 shadow-sm">
                        {card}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="px-4 sm:px-8 py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">
              Всё что нужно команде
            </h2>
            <p className="text-gray-500 text-center mb-12 max-w-md mx-auto">
              Никаких лишних функций — только то, что реально помогает сдать проект вовремя.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                {
                  Icon: Kanban,
                  title: 'Канбан доски',
                  desc: 'Организуй задачи командой, перетаскивай карточки, назначай исполнителей и расставляй приоритеты.',
                  accent: 'bg-indigo-50 text-indigo-500',
                },
                {
                  Icon: CheckSquare,
                  title: 'Таск трекер',
                  desc: 'Следи за прогрессом, фильтруй задачи по приоритету и дедлайну, смотри всё в одном списке.',
                  accent: 'bg-violet-50 text-violet-500',
                },
                {
                  Icon: Paperclip,
                  title: 'Файлы и комментарии',
                  desc: 'Прикрепляй материалы прямо к задачам — никакого лишнего мессенджера и потерянных ссылок.',
                  accent: 'bg-blue-50 text-blue-500',
                },
              ].map(({ Icon, title, desc, accent }) => (
                <div
                  key={title}
                  className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${accent}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free section ── */}
        <section className="px-4 sm:px-8 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 mb-6">
              <span className="text-2xl">🎓</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Никаких платежей. Никогда.
            </h2>
            <p className="text-gray-500 mb-10">
              Collab создан студентами для студентов — и останется бесплатным.
            </p>

            <ul className="space-y-3 mb-10 text-left inline-block">
              {[
                'Неограниченные доски и колонки',
                'Совместная работа всей команды',
                'Загрузка файлов и вложений',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <div>
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-md shadow-indigo-100"
              >
                Создать аккаунт
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-4 sm:px-8 py-6 text-center text-sm text-gray-400">
        Collab © 2026 — сделано для студентов
      </footer>
    </div>
  )
}
