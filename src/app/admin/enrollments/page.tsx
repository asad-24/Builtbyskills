import { getAdminPeopleOptions } from "@/features/admin/people-options"
import { RecordPagination } from "@/components/admin/record-pagination"
import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { EnrollmentManagementForm } from "@/components/admin/portal-management"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Enrollments | Builtbyskills Admin",
}

export default async function AdminEnrollmentsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> } = {}) {
  const result = await getAdminWorkspaceData({ entity: "enrollments", page: (await searchParams)?.page })
  if (!result.ok) return <SetupNotice message={result.message} />

  const studentOptions = await getAdminPeopleOptions("student")
  return (
    <>
      <PageHeader title="Enrollments" description="Review active, pending, suspended, completed, expired, and cancelled course assignments." />
      <EnrollmentManagementForm courses={result.data.courses.map(course => ({ value: course.id, label: course.title }))} students={studentOptions} />
      <div className="mt-6" />
      <AdminTable
        columns={["Student", "Course", "Status", "Starts", "Expires", "Assigned", "Manage access"]}
        rows={result.data.enrollments.map((enrollment) => [
          enrollment.student?.full_name ?? "Unknown student",
          enrollment.course?.title ?? "Unknown course",
          <StatusBadge key={enrollment.id}>{enrollment.status}</StatusBadge>,
          formatDate(enrollment.starts_at),
          formatDate(enrollment.expires_at),
          formatDate(enrollment.created_at),
          <details key={enrollment.id} className="min-w-72"><summary className="cursor-pointer font-medium">Edit access</summary><div className="mt-4"><EnrollmentManagementForm courses={[]} students={[]} enrollment={{ student_id: enrollment.student_id, course_id: enrollment.course_id, status: enrollment.status, starts_at: enrollment.starts_at, expires_at: enrollment.expires_at }} /></div></details>,
        ])}
      />
      <RecordPagination {...result.data.pagination} />
    </>
  )
}
