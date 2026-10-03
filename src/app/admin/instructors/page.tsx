import { DeleteRecord, EditInstructor } from "@/components/admin/record-actions"
import { deleteInstructorAction } from "@/actions/admin-records"
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
        columns={["Name", "Email", "Status", "Created", "Actions"]}
        rows={result.data.instructors.map((instructor) => [
          instructor.full_name,
          instructor.email,
          <StatusBadge key={instructor.id}>{instructor.status}</StatusBadge>,
          formatDate(instructor.created_at),
          <div key={instructor.id} className="flex flex-wrap gap-2"><EditInstructor instructor={instructor} /><DeleteRecord id={instructor.id} updatedAt={instructor.updated_at} label={instructor.full_name} action={deleteInstructorAction} description="This will retire the instructor by making their profile inactive. Their account, course assignments, live classes, and history will be preserved." /></div>,
        ])}
      />
    </>
  )
}
