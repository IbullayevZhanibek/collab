export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-brand-50 via-white to-violet-50 overflow-hidden">
      {/* Мягкие декоративные пятна на фоне */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  )
}
