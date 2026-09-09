import Link from "next/link"

import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { getStudentDashboardData } from "@/features/student/data"
import { formatDate } from "@/lib/format"

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
          const lesson = enrollment.course?.course_sections?.[0]?.lessons?.[0]
          return [
            enrollment.course?.title ?? "Unknown course",
            <StatusBadge key={enrollment.id}>{enrollment.status}</StatusBadge>,
            formatDate(enrollment.starts_at),
            formatDate(enrollment.expires_at),
            lesson ? <Button key={lesson.id} asChild size="sm"><Link href={`/student/lessons/${lesson.id}`}>Open</Link></Button> : "No lessons",
          ]
        })}
      />
    </>
  )
}
