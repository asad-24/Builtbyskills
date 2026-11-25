import { RecordPagination } from "@/components/admin/record-pagination"
import { DeleteRecord, EditInstructor } from "@/components/admin/record-actions"
import { deleteInstructorAction } from "@/actions/admin-records"
import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { CreateInstructorDialog } from "@/components/admin/instructor-actions"
import { getAdminInstructorsData } from "@/features/admin/read-models"
import { InstructorAssignmentForm } from "@/components/admin/portal-management"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Instructors | Builtbyskills Admin",
}

export default async function AdminInstructorsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> } = {}) {
  const result = await getAdminInstructorsData((await searchParams)?.page)
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader
        title="Instructors"
        description="Create instructor accounts, manage their status, and assign or remove specific courses."
        action={<CreateInstructorDialog />}
      />
      <InstructorAssignmentForm courses={result.data.courses.map(course => ({ value: course.id, label: course.title }))} instructors={result.data.instructorOptions} />
      <div className="mt-6" />
      <AdminTable
        columns={["Name", "Email", "Status", "Assigned courses", "Created", "Actions"]}
        rows={result.data.instructors.map((instructor) => [
          instructor.full_name,
          instructor.email,
          <StatusBadge key={instructor.id}>{instructor.status}</StatusBadge>,
          instructor.assignments.map(item => item.course?.title ?? "Course").join(", ") || "No assigned courses",
          formatDate(instructor.created_at),
          <div key={instructor.id} className="flex flex-wrap gap-2"><EditInstructor instructor={instructor} /><DeleteRecord id={instructor.id} updatedAt={instructor.updated_at} label={instructor.full_name} action={deleteInstructorAction} description="This will retire the instructor by making their profile inactive. Their account, course assignments, live classes, and history will be preserved." /></div>,
        ])}
      />
      <RecordPagination {...result.data.pagination} />
    </>
  )
}
