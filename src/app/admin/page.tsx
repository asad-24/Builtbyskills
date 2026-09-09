import { AdminTable, PageHeader, SetupNotice, StatCard, StatusBadge } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate, formatMoney } from "@/lib/format"

export const metadata = {
  title: "Admin Dashboard | Builtbyskills",
}

export default async function AdminOverviewPage() {
  const result = await getAdminWorkspaceData()

  if (!result.ok) return <SetupNotice message={result.message} />

  const { stats, payments, liveClasses, auditLogs } = result.data

  return (
    <>
      <PageHeader
        title="Overview"
        description="Real-time operational view of students, enrollments, payments, courses, live classes, and important admin activity."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={stats.totalStudents} />
        <StatCard label="Active students" value={stats.activeStudents} />
        <StatCard label="Pending enrollments" value={stats.pendingEnrollments} />
        <StatCard label="Pending payments" value={stats.pendingPayments} />
        <StatCard label="Published courses" value={stats.publishedCourses} />
        <StatCard label="Upcoming live classes" value={stats.upcomingLiveClasses} />
        <StatCard label="Completed lessons" value={stats.completedLessons} detail="Completion events recorded in lesson progress." />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section>
          <h3 className="mb-3 font-semibold">Recent payments</h3>
          <AdminTable
            columns={["Course", "Amount", "Status", "Submitted"]}
            rows={payments.slice(0, 6).map((payment) => [
              payment.course?.title ?? "Unknown course",
              formatMoney(payment.amount, payment.currency),
              <StatusBadge key={payment.id}>{payment.status}</StatusBadge>,
              formatDate(payment.submitted_at),
            ])}
          />
        </section>
        <section>
          <h3 className="mb-3 font-semibold">Upcoming live classes</h3>
          <AdminTable
            columns={["Title", "Course", "Status", "Starts"]}
            rows={liveClasses.slice(0, 6).map((item) => [
              item.title,
              item.course?.title ?? "All courses",
              <StatusBadge key={item.id}>{item.status}</StatusBadge>,
              formatDate(item.starts_at),
            ])}
          />
        </section>
      </div>
      <section className="mt-8">
        <h3 className="mb-3 font-semibold">Audit activity</h3>
        <AdminTable
          columns={["Action", "Entity", "Actor", "When"]}
          rows={auditLogs.slice(0, 8).map((log) => [
            log.action,
            log.entity_type,
            log.actor?.full_name ?? "System",
            formatDate(log.created_at),
          ])}
        />
      </section>
    </>
  )
}
