import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { StudentClassLinks } from "@/components/student/course-links"
import { getCourseWorkspace } from "@/lib/courses/portal-access"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"

export const dynamic = "force-dynamic"
export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  if (!z.string().uuid().safeParse(courseId).success) notFound()
  let data
  try { data = await getCourseWorkspace(courseId, "student") }
  catch (error) {
    if (error instanceof AppAuthError || error instanceof AppForbiddenError) notFound()
    return <SetupNotice message="Unable to load this course. Please try again or contact the academy." />
  }
  return <>
    <Link href="/student/courses" className="mb-5 inline-block text-sm underline">Back to my courses</Link>
    <PageHeader title={data.course.title} description="Live classes, recorded lectures, and lessons included with your approved enrollment." />
    <StudentClassLinks classes={data.classes} recordings={data.recordings} />
    <section className="mt-8"><h3 className="mb-4 text-lg font-semibold">Course lessons</h3>{!data.sections.length ? <p className="text-sm text-slate-600">No lesson sections have been published yet.</p> : null}{data.sections.map(section => <article key={section.id} className="mb-4 rounded-xl border border-slate-200 bg-white p-5"><h4 className="font-semibold">{section.title}</h4><ul className="mt-3 grid gap-2">{(section.lessons ?? []).filter(lesson => lesson.status === "published").sort((a,b) => a.position-b.position).map(lesson => <li key={lesson.id}><Link className="text-sm font-medium underline" href={`/student/lessons/${lesson.id}`}>{lesson.title}</Link></li>)}</ul></article>)}</section>
  </>
}
