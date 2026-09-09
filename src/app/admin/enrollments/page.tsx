import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Enrollments | Builtbyskills Admin",
}

export default async function AdminEnrollmentsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Enrollments" description="Review active, pending, suspended, completed, expired, and cancelled course assignments." />
      <AdminTable
        columns={["Student", "Course", "Status", "Starts", "Expires", "Assigned"]}
        rows={result.data.enrollments.map((enrollment) => [
          enrollment.student?.full_name ?? "Unknown student",
          enrollment.course?.title ?? "Unknown course",
          <StatusBadge key={enrollment.id}>{enrollment.status}</StatusBadge>,
          formatDate(enrollment.starts_at),
          formatDate(enrollment.expires_at),
          formatDate(enrollment.created_at),
        ])}
      />
    </>
  )
}
