import { PageHeader, SetupNotice, StatCard } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"

export const metadata = {
  title: "Reports | Builtbyskills Admin",
}

export default async function AdminReportsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const { stats } = result.data

  return (
    <>
      <PageHeader title="Reports" description="Operational summary for enrollments, course availability, payments, and learning progress." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Course completion events" value={stats.completedLessons} />
        <StatCard label="Published course catalog" value={stats.publishedCourses} />
        <StatCard label="Students awaiting activation" value={stats.pendingEnrollments} />
        <StatCard label="Payment queue" value={stats.pendingPayments} />
        <StatCard label="Active students" value={stats.activeStudents} />
        <StatCard label="Live classes ahead" value={stats.upcomingLiveClasses} />
      </div>
    </>
  )
}
