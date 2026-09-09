import { reviewPaymentAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextAreaField } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate, formatMoney } from "@/lib/format"

export const metadata = {
  title: "Payments | Builtbyskills Admin",
}

export default async function AdminPaymentsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const paymentOptions = result.data.payments.map((payment) => ({
    value: payment.id,
    label: `${payment.course?.title ?? "Course"} - ${formatMoney(payment.amount, payment.currency)} - ${payment.status}`,
  }))

  return (
    <>
      <PageHeader title="Payments" description="Review manual payment submissions, approve access, reject with a reason, or mark refunds." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Course", "Student", "Amount", "Reference", "Screenshot", "Status", "Submitted"]}
          rows={result.data.payments.map((payment) => [
            payment.course?.title ?? "Unknown course",
            payment.student?.full_name ?? "Enrollment visitor",
            formatMoney(payment.amount, payment.currency),
            payment.transaction_reference ?? "Not provided",
            payment.screenshot_path ?? "Not uploaded",
            <StatusBadge key={payment.id}>{payment.status}</StatusBadge>,
            formatDate(payment.submitted_at),
          ])}
        />
        <Panel title="Review payment">
          <ActionForm action={reviewPaymentAction} submitLabel="Save review">
            <SelectField name="payment_id" label="Payment" options={paymentOptions} />
            <SelectField name="status" label="New status" options={[
              { value: "under_review", label: "Under review" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "refunded", label: "Refunded" },
            ]} />
            <TextAreaField name="rejection_reason" label="Rejection reason" rows={3} />
          </ActionForm>
        </Panel>
      </div>
    </>
  )
}
