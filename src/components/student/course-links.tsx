import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"

type CourseRef = { title: string } | { title: string }[] | null
function courseTitle(course?: CourseRef) { return Array.isArray(course) ? course[0]?.title : course?.title }
type ClassItem = { id: string; title: string; starts_at: string; status: string; course?: CourseRef }
type RecordingItem = { id: string; title: string; description?: string | null; course?: CourseRef }
export function StudentClassLinks({ classes, recordings = [] }: { classes: ClassItem[]; recordings?: RecordingItem[] }) {
  return <div className="grid gap-6">
    <section><h3 className="mb-3 text-lg font-semibold">Live classes</h3><div className="grid gap-3">{classes.filter(item => ["scheduled", "live"].includes(item.status)).map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"><div><h4 className="font-semibold">{item.title}</h4>{item.course ? <p className="mt-1 text-xs font-medium text-slate-500">{courseTitle(item.course)}</p> : null}<p className="mt-1 text-sm text-slate-600">{formatDate(item.starts_at)} PKT · {item.status}</p></div><Button asChild><a href={`/api/student/classes/${item.id}`} target="_blank" rel="noopener noreferrer">Join class</a></Button></article>)}</div>{!classes.some(item => ["scheduled", "live"].includes(item.status)) ? <p className="text-sm text-slate-600">No live classes are available yet.</p> : null}</section>
    <section><h3 className="mb-3 text-lg font-semibold">Recorded lectures</h3><div className="grid gap-3">{recordings.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"><div><h4 className="font-semibold">{item.title}</h4>{item.course ? <p className="mt-1 text-xs font-medium text-slate-500">{courseTitle(item.course)}</p> : null}{item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}</div><Button asChild><a href={`/api/student/recordings/${item.id}`} target="_blank" rel="noopener noreferrer">Watch recording</a></Button></article>)}</div>{!recordings.length ? <p className="text-sm text-slate-600">Your teacher has not published any recording links yet.</p> : null}</section>
  </div>
}
