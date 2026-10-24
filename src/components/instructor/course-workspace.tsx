import { notFound } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { ClassEditor, RecordingEditor } from "@/components/instructor/course-link-editors"
import { getCourseWorkspace } from "@/lib/courses/portal-access"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"

export async function CourseLinksWorkspace({ courseId, backHref = "/instructor/courses" }: { courseId: string; backHref?: string }) {
  if (!z.string().uuid().safeParse(courseId).success) notFound()
  let data
  try { data = await getCourseWorkspace(courseId, "manager") }
  catch (error) {
    if (error instanceof AppAuthError || error instanceof AppForbiddenError) notFound()
    return <SetupNotice message="Unable to load this course. Confirm the course portal migration is installed and try again." />
  }
  return <>
    <Link href={backHref} className="mb-5 inline-block text-sm font-medium underline">Back to courses</Link>
    <PageHeader title={data.course.title} description="Manage this course’s live sessions and recordings. Saved changes are available to enrolled students on refresh." />
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section className="grid gap-5"><ClassEditor courseId={courseId} />{data.classes.map(item => <details key={`${item.id}-${item.updated_at}`} className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-medium">{item.title} · {item.status}</summary><div className="mt-4"><ClassEditor courseId={courseId} item={item} /></div></details>)}</section>
      <section className="grid gap-5"><RecordingEditor courseId={courseId} />{data.recordings.map(item => <details key={`${item.id}-${item.updated_at}`} className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-medium">{item.title} · {item.is_published ? "Published" : "Draft"}</summary><div className="mt-4"><RecordingEditor courseId={courseId} item={item} /></div></details>)}</section>
    </div>
  </>
}
