import { DeleteRecord } from "@/components/admin/record-actions"
import { deletePaymentMethodAction } from "@/actions/admin-records"
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-ui"
import { SetupNotice } from "@/components/admin/admin-ui"
import { PaymentMethodForm, PaymentMethodAvailabilityForm } from "@/components/admin/payment-method-form"
import { getAdminWorkspaceData } from "@/features/admin/data"

export const metadata = { title: "Payment Settings | Builtbyskills Admin" }

const typeLabels: Record<string, string> = { bank_transfer: "Bank Transfer", jazzcash: "JazzCash", easypaisa: "EasyPaisa" }

export default async function AdminPaymentSettingsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return <>
    <PageHeader title="Payment Settings" description="Manage the payment details available during enrollment. Multiple methods can be active at the same time." />
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_420px]">
      <div className="grid min-w-0 gap-4">
        <p className="text-sm leading-6 text-slate-600">Edit an existing method to correct its details. Retire obsolete methods by deactivating them. Methods with payment history cannot be deleted. Unreferenced methods can be permanently deleted.</p>
        {result.data.paymentMethods.length === 0 ? <EmptyState title="No payment methods yet" description="Add a payment method so students can pay during enrollment." /> : null}
        {result.data.paymentMethods.map(method => <Panel key={method.id} title={method.display_name}>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-600">{typeLabels[method.method_type] ?? method.method_type}</span>
            <span className={method.is_active ? "rounded-full bg-emerald-50 px-3 py-1 text-emerald-700" : "rounded-full bg-slate-100 px-3 py-1 text-slate-600"}>{method.is_active ? "Active" : "Inactive"}</span>
          </div>
          <dl className="mb-4 grid gap-2 text-sm text-slate-700">
            <div><dt className="inline font-medium">Account title: </dt><dd className="inline">{method.account_title}</dd></div>
            <div><dt className="inline font-medium">Account number: </dt><dd className="inline break-all">{method.account_number}</dd></div>
            {method.iban_number ? <div><dt className="inline font-medium">IBAN: </dt><dd className="inline break-all">{method.iban_number}</dd></div> : null}
          </dl>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Edit payment details</summary>
            <div className="mt-4"><PaymentMethodForm key={method.updated_at} method={method} /></div>
          </details>
          <PaymentMethodAvailabilityForm key={method.updated_at + String(method.is_active)} method={method} />
        <div className="mt-3"><DeleteRecord id={method.id} updatedAt={method.updated_at} label={method.display_name} action={deletePaymentMethodAction} description="Permanently delete this payment method? Methods with payment submissions cannot be deleted; deactivate them instead to preserve history." /></div>
        </Panel>)}
      </div>
      <Panel title="Add payment method"><PaymentMethodForm /></Panel>
    </div>
  </>
}
