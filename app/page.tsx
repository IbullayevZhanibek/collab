import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Kanban, CheckSquare, Smartphone, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/ui/logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { AuthRedirectHandler } from '@/components/auth/AuthRedirectHandler'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  const t = await getTranslations('landing')

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Подхват ?code / #access_token, если письмо привело на корень сайта */}
      <AuthRedirectHandler />

      {/* ── Nav ── */}
      <nav className="border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between">
        <Logo size={32} withWordmark />
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
          >
            {t('nav.login')}
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-brand-600 hover:bg-brand-700 hover:shadow-glow text-white px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
          >
            {t('nav.signup')}
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative px-4 sm:px-8 pt-20 pb-24 flex flex-col items-center text-center overflow-hidden">
          {/* мягкое сияние позади заголовка */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-72 w-[40rem] max-w-full bg-brand-100/50 blur-3xl rounded-full" />

          <div className="relative inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 ring-1 ring-inset ring-brand-600/10">
            <span>✦</span>
            <span>{t('hero.badge')}</span>
          </div>

          <h1 className="relative text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight max-w-3xl">
            {t.rich('hero.title', {
              accent: (chunks) => <span className="text-brand-600">{chunks}</span>,
            })}
          </h1>

          <p className="relative mt-5 text-lg sm:text-xl text-gray-500 max-w-xl leading-relaxed">
            {t('hero.subtitle')}
          </p>

          <div className="relative mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 hover:shadow-glow text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all active:scale-[0.98]"
            >
              {t('hero.ctaPrimary')}
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center border border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white text-gray-700 font-semibold px-7 py-3.5 rounded-xl text-base transition-colors"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>

          <p className="relative mt-4 text-xs text-gray-400">
            {t('hero.noCard')}
          </p>

          {/* Превью доски */}
          <div className="relative mt-16 w-full max-w-2xl bg-gray-50 border border-gray-200 rounded-2xl p-5 text-left shadow-card">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-300" />
              <div className="w-3 h-3 rounded-full bg-amber-300" />
              <div className="w-3 h-3 rounded-full bg-emerald-300" />
            </div>
            <div className="flex gap-3 overflow-hidden">
              {[
                { title: t('preview.todoTitle'), color: 'bg-gray-200 text-gray-700', cards: t.raw('preview.todoCards') as string[] },
                { title: t('preview.inProgressTitle'), color: 'bg-brand-100 text-brand-700', cards: t.raw('preview.inProgressCards') as string[] },
                { title: t('preview.doneTitle'), color: 'bg-emerald-100 text-emerald-700', cards: t.raw('preview.doneCards') as string[] },
              ].map((col) => (
                <div key={col.title} className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold px-2 py-1 rounded-md mb-2 w-fit ${col.color}`}>
                    {col.title}
                  </div>
                  <div className="space-y-2">
                    {col.cards.map((card) => (
                      <div key={card} className="bg-white rounded-lg px-3 py-2 text-xs text-gray-700 border border-gray-100 shadow-soft">
                        {card}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Преимущества ── */}
        <section className="px-4 sm:px-8 py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">
              {t('features.title')}
            </h2>
            <p className="text-gray-500 text-center mb-12 max-w-md mx-auto">
              {t('features.subtitle')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                {
                  Icon: Kanban,
                  title: t('features.kanbanTitle'),
                  desc: t('features.kanbanDesc'),
                  accent: 'bg-brand-50 text-brand-600',
                },
                {
                  Icon: CheckSquare,
                  title: t('features.tasksTitle'),
                  desc: t('features.tasksDesc'),
                  accent: 'bg-violet-50 text-violet-600',
                },
                {
                  Icon: Smartphone,
                  title: t('features.devicesTitle'),
                  desc: t('features.devicesDesc'),
                  accent: 'bg-blue-50 text-blue-600',
                },
              ].map(({ Icon, title, desc, accent }) => (
                <div
                  key={title}
                  className="bg-white rounded-2xl border border-gray-100 p-6 shadow-soft hover:shadow-card transition-shadow"
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

        {/* ── Бесплатно ── */}
        <section className="px-4 sm:px-8 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 mb-6">
              <span className="text-2xl">🎓</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              {t('benefits.title')}
            </h2>
            <p className="text-gray-500 mb-10 max-w-md mx-auto">
              {t('benefits.subtitle')}
            </p>

            <ul className="space-y-3 mb-10 text-left inline-block">
              {(t.raw('benefits.items') as string[]).map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <div>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 hover:shadow-glow text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all active:scale-[0.98]"
              >
                {t('benefits.cta')}
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Logo size={24} withWordmark wordmarkClassName="text-base" />
        <p className="text-sm text-gray-400">{t('footer')}</p>
      </footer>
    </div>
  )
}
