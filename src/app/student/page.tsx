import Link from "next/link"

import { AdminTable, PageHeader, SetupNotice, StatCard, StatusBadge } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { getStudentDashboardData } from "@/features/student/data"
import { formatDate } from "@/lib/format"
import type { SectionWithLessons } from "@/types/lms"

export const metadata = {
  title: "Student Dashboard | Builtbyskills",
}

export default async function StudentDashboardPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const activeEnrollments = result.data.enrollments.filter((item) => item.status === "active")
  const completed = result.data.progress.filter((item) => item.is_completed).length
  const totalLessons = activeEnrollments.reduce((sum, enrollment) => {
    return sum + (enrollment.course?.course_sections ?? []).reduce((sectionSum: number, section: SectionWithLessons) => sectionSum + (section.lessons?.length ?? 0), 0)
  }, 0)
  const overall = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0
  const firstLesson = activeEnrollments[0]?.course?.course_sections?.[0]?.lessons?.[0]

  return (
    <>
      <PageHeader title={`Welcome, ${result.data.profile.full_name}`} description="Continue your assigned courses, join live classes, and track learning progress." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active courses" value={activeEnrollments.length} />
        <StatCard label="Overall progress" value={`${overall}%`} />
        <StatCard label="Completed lessons" value={completed} />
      </div>
      {firstLesson ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Continue Learning</h2>
          <p className="mt-2 text-sm text-slate-600">{firstLesson.title}</p>
          <Button asChild className="mt-4">
            <Link href={`/student/lessons/${firstLesson.id}`}>Open lesson</Link>
          </Button>
        </div>
      ) : null}
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Next live class</h2>
        <AdminTable columns={["Title", "Course", "Starts", "Status"]} rows={result.data.liveClasses.slice(0, 1).map((item) => [item.title, item.course?.title ?? "Course", formatDate(item.starts_at), <StatusBadge key={item.id}>{item.status}</StatusBadge>])} />
      </section>
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Recent announcements</h2>
        <AdminTable columns={["Title", "Course", "Published"]} rows={result.data.announcements.slice(0, 5).map((item) => [item.title, item.course?.title ?? "All", formatDate(item.published_at)])} />
      </section>
    </>
  )
}
