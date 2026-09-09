export default function AdminLoading() {
  return (
    <div className="grid gap-4">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  )
}
