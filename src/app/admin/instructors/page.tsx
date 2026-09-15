import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextField } from "@/components/admin/admin-ui"
import { createInstructorAction } from "@/actions/admin"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Instructors | Builtbyskills Admin",
}

export default async function AdminInstructorsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Instructors" description="View instructors available for course assignment. Add instructors in Supabase Auth, then create a profile with instructor role." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Name", "Email", "Status", "Created"]}
          rows={result.data.instructors.map((instructor) => [
            instructor.full_name,
            instructor.email,
            <StatusBadge key={instructor.id}>{instructor.status}</StatusBadge>,
            formatDate(instructor.created_at),
          ])}
        />
        <div className="grid gap-6">
          <Panel title="Create instructor">
            <ActionForm action={createInstructorAction} submitLabel="Create instructor">
              <TextField name="full_name" label="Full name" required />
              <TextField name="email" label="Email" type="email" required />
              <SelectField name="status" label="Status" defaultValue="active" options={["active", "inactive", "suspended"].map((value) => ({ value, label: value }))} />
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  )
}
