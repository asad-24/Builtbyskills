import { AdminTable, PageHeader, SetupNotice, StatCard, StatusBadge } from "@/components/admin/admin-ui"
import { getInstructorDashboardData } from "@/features/instructor/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Instructor Dashboard | Builtbyskills",
}

export default async function InstructorDashboardPage() {
  const result = await getInstructorDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const enrolledStudents = result.data.assignedCourses.reduce((sum, item) => sum + (item.course?.enrollments?.length ?? 0), 0)

  return (
    <>
      <PageHeader title={`Welcome, ${result.data.profile.full_name}`} description="Manage assigned courses, live schedules, announcements, and student progress." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assigned courses" value={result.data.assignedCourses.length} />
        <StatCard label="Enrolled students" value={enrolledStudents} />
        <StatCard label="Scheduled classes" value={result.data.liveClasses.filter((item) => item.status === "scheduled").length} />
      </div>
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Assigned courses</h2>
        <AdminTable columns={["Course", "Status", "Students"]} rows={result.data.assignedCourses.map((item) => [item.course?.title ?? "Course", <StatusBadge key={item.id}>{item.course?.status ?? "draft"}</StatusBadge>, item.course?.enrollments?.length ?? 0])} />
      </section>
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Live classes</h2>
        <AdminTable columns={["Title", "Course", "Starts", "Status"]} rows={result.data.liveClasses.slice(0, 5).map((item) => [item.title, item.course?.title ?? "Course", formatDate(item.starts_at), <StatusBadge key={item.id}>{item.status}</StatusBadge>])} />
      </section>
    </>
  )
}
