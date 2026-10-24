import { getAdminPeopleOptions } from "@/features/admin/people-options"
import { RecordPagination } from "@/components/admin/record-pagination"
import { DeleteRecord, EditInstructor } from "@/components/admin/record-actions"
import { deleteInstructorAction } from "@/actions/admin-records"
import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { CreateInstructorDialog } from "@/components/admin/instructor-actions"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { InstructorAssignmentForm } from "@/components/admin/portal-management"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Instructors | Builtbyskills Admin",
}

export default async function AdminInstructorsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> } = {}) {
  const result = await getAdminWorkspaceData({ entity: "instructors", page: (await searchParams)?.page })
  if (!result.ok) return <SetupNotice message={result.message} />

  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const assignments = await supabase.from("instructor_courses").select("id,instructor_id,course_id")
  if (assignments.error) return <SetupNotice message="Unable to read teacher assignments. Please try again." />
  const instructorOptions = await getAdminPeopleOptions("instructor")
  return (
    <>
      <PageHeader
        title="Instructors"
        description="Create instructor accounts, manage their status, and assign or remove specific courses."
        action={<CreateInstructorDialog />}
      />
      <InstructorAssignmentForm courses={result.data.courses.map(course => ({ value: course.id, label: course.title }))} instructors={instructorOptions} />
      <div className="mt-6" />
      <AdminTable
        columns={["Name", "Email", "Status", "Assigned courses", "Created", "Actions"]}
        rows={result.data.instructors.map((instructor) => [
          instructor.full_name,
          instructor.email,
          <StatusBadge key={instructor.id}>{instructor.status}</StatusBadge>,
          (assignments.data ?? []).filter(item => item.instructor_id === instructor.id).map(item => result.data.courses.find(course => course.id === item.course_id)?.title ?? "Course").join(", ") || "No assigned courses",
          formatDate(instructor.created_at),
          <div key={instructor.id} className="flex flex-wrap gap-2"><EditInstructor instructor={instructor} /><DeleteRecord id={instructor.id} updatedAt={instructor.updated_at} label={instructor.full_name} action={deleteInstructorAction} description="This will retire the instructor by making their profile inactive. Their account, course assignments, live classes, and history will be preserved." /></div>,
        ])}
      />
      <RecordPagination {...result.data.pagination} />
    </>
  )
}
