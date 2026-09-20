import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { CreateInstructorDialog } from "@/components/admin/instructor-actions"
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
      <PageHeader
        title="Instructors"
        description="View instructors available for course assignment. Add instructors in Supabase Auth, then create a profile with instructor role."
        action={<CreateInstructorDialog />}
      />
      <AdminTable
        columns={["Name", "Email", "Status", "Created"]}
        rows={result.data.instructors.map((instructor) => [
          instructor.full_name,
          instructor.email,
          <StatusBadge key={instructor.id}>{instructor.status}</StatusBadge>,
          formatDate(instructor.created_at),
        ])}
      />
    </>
  )
}
