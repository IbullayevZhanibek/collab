// Скелетон дашборда на время загрузки статистики, уведомлений и списка досок.
export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <div className="h-8 w-56 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-72 rounded bg-gray-100 animate-pulse mt-2" />
        </div>

        {/* Карточки статистики */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white border border-gray-200 animate-pulse" />
          ))}
        </div>

        {/* Список досок */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-white border border-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
