import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getStudentDashboardData } from "@/features/student/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Live Classes | Builtbyskills Student",
}

export default async function StudentLiveClassesPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />
  return (
    <>
      <PageHeader title="Live Classes" description="Upcoming live sessions for your enrolled courses." />
      <AdminTable columns={["Title", "Course", "Starts", "Status"]} rows={result.data.liveClasses.map((item) => [item.title, item.course?.title ?? "Course", formatDate(item.starts_at), <StatusBadge key={item.id}>{item.status}</StatusBadge>])} />
    </>
  )
}
