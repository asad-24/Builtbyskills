import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getInstructorDashboardData } from "@/features/instructor/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Announcements | Builtbyskills Instructor",
}

export default async function InstructorAnnouncementsPage() {
  const result = await getInstructorDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Announcements" description="Announcements authored from your instructor account." />
      <AdminTable columns={["Title", "Course", "Published", "Created"]} rows={result.data.announcements.map((item) => [item.title, item.course?.title ?? "Course", <StatusBadge key={item.id}>{item.is_published ? "published" : "draft"}</StatusBadge>, formatDate(item.created_at)])} />
    </>
  )
}
