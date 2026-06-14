// Скелетон страницы «Мои задачи».
export default function TasksLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-44 rounded bg-gray-200 animate-pulse" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white border border-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
