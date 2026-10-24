import Link from "next/link"
export function RecordPagination({ page = 1, hasNext = false }: { page?: number; hasNext?: boolean }) {
  if (page === 1 && !hasNext) return null
  return <nav aria-label="Record pages" className="mt-6 flex items-center justify-between gap-4 text-sm">
    {page > 1 ? <Link href={`?page=${page-1}`} className="rounded-lg border border-slate-200 bg-white px-4 py-2">Previous</Link> : <span />}
    <span className="text-slate-600">Page {page}</span>
    {hasNext ? <Link href={`?page=${page+1}`} className="rounded-lg border border-slate-200 bg-white px-4 py-2">Next</Link> : <span />}
  </nav>
}
