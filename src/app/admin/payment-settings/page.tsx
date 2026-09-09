import { createPaymentMethodAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"

export const metadata = {
  title: "Payment Settings | Builtbyskills Admin",
}

export default async function AdminPaymentSettingsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Payment Settings" description="Manage bank transfer, Easypaisa, and JazzCash instructions shown during enrollment." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Display name", "Type", "Account title", "Account number", "Bank", "Active"]}
          rows={result.data.paymentMethods.map((method) => [
            method.display_name,
            method.method_type,
            method.account_title,
            method.account_number,
            method.bank_name ?? "Not set",
            <StatusBadge key={method.id}>{method.is_active ? "active" : "inactive"}</StatusBadge>,
          ])}
        />
        <Panel title="Add payment method">
          <ActionForm action={createPaymentMethodAction} submitLabel="Add method">
            <SelectField name="method_type" label="Method type" options={[
              { value: "bank_transfer", label: "Bank Transfer" },
              { value: "easypaisa", label: "Easypaisa" },
              { value: "jazzcash", label: "JazzCash" },
            ]} />
            <TextField name="display_name" label="Display name" required />
            <TextField name="account_title" label="Account title" required />
            <TextField name="account_number" label="Account number" required />
            <TextField name="bank_name" label="Bank name" />
            <TextAreaField name="instructions" label="Instructions" rows={3} />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="is_active" value="true" defaultChecked className="size-4 rounded border-slate-300" />
              Active
            </label>
          </ActionForm>
        </Panel>
      </div>
    </>
  )
}
