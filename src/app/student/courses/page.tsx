import Link from "next/link"

import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { getStudentDashboardData } from "@/features/student/data"
import { formatDate } from "@/lib/format"
import { firstAccessibleLesson } from "@/lib/lessons/discovery"
import { enrollmentIsActive } from "@/lib/permissions"

export const metadata = {
  title: "My Courses | Builtbyskills",
}

export default async function StudentCoursesPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="My Courses" description="Only courses assigned to your account are shown here." />
      <AdminTable
        columns={["Course", "Status", "Starts", "Expires", "Open"]}
        rows={result.data.enrollments.map((enrollment) => {
          const lesson = firstAccessibleLesson(enrollment, enrollment.course?.course_sections)
          return [
            enrollment.course?.title ?? "Unknown course",
            <StatusBadge key={enrollment.id}>{enrollment.status}</StatusBadge>,
            formatDate(enrollment.starts_at),
            formatDate(enrollment.expires_at),
            enrollmentIsActive(enrollment) && enrollment.course?.status === "published" ? <div key={enrollment.id} className="flex flex-wrap gap-2"><Button asChild size="sm"><Link href={`/student/courses/${enrollment.course_id}`}>Open course</Link></Button>{lesson ? <Button asChild size="sm" variant="outline"><Link href={`/student/lessons/${lesson.id}`}>Open</Link></Button> : <span className="text-sm text-slate-600">No published lessons are available yet.</span>}</div> : "Course access is not currently active.",
          ]
        })}
      />
    </>
  )
}
