// Мгновенный скелетон доски — показывается во время загрузки Server Component,
// чтобы переход на доску ощущался моментальным.
export default function BoardLoading() {
  return (
    <div className="flex flex-col min-h-screen w-full bg-gray-50">
      {/* Шапка */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between sticky top-14 md:top-0 z-10">
        <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
        <div className="h-8 w-24 rounded-lg bg-gray-200 animate-pulse" />
      </div>

      {/* Колонки */}
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex gap-3 sm:gap-4 items-start overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-[280px] sm:w-72 shrink-0 rounded-2xl bg-white border border-gray-200 p-3">
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse mb-4" />
              <div className="space-y-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
