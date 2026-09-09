import { AdminTable, PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { getStudentDashboardData } from "@/features/student/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Announcements | Builtbyskills Student",
}

export default async function StudentAnnouncementsPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />
  return (
    <>
      <PageHeader title="Announcements" description="Course and academy updates for your account." />
      <AdminTable columns={["Title", "Course", "Published"]} rows={result.data.announcements.map((item) => [item.title, item.course?.title ?? "All", formatDate(item.published_at)])} />
    </>
  )
}
