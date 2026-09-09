import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getStudentDashboardData } from "@/features/student/data"
import { formatDate, formatMoney } from "@/lib/format"

export const metadata = {
  title: "Payment History | Builtbyskills Student",
}

export default async function StudentPaymentHistoryPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />
  return (
    <>
      <PageHeader title="Payment History" description="Manual payment submissions connected to your profile." />
      <AdminTable columns={["Course", "Amount", "Status", "Submitted"]} rows={result.data.payments.map((payment) => [payment.course?.title ?? "Course", formatMoney(payment.amount, payment.currency), <StatusBadge key={payment.id}>{payment.status}</StatusBadge>, formatDate(payment.submitted_at)])} />
    </>
  )
}
