// Скелетон календаря на время загрузки задач месяца.
export default function CalendarLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-white border border-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
