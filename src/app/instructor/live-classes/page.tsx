import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getInstructorDashboardData } from "@/features/instructor/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Live Classes | Builtbyskills Instructor",
}

export default async function InstructorLiveClassesPage() {
  const result = await getInstructorDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Live Classes" description="Live sessions connected to your instructor profile." />
      <AdminTable columns={["Title", "Course", "Provider", "Starts", "Status"]} rows={result.data.liveClasses.map((item) => [item.title, item.course?.title ?? "Course", item.meeting_provider, formatDate(item.starts_at), <StatusBadge key={item.id}>{item.status}</StatusBadge>])} />
    </>
  )
}
