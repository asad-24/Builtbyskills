import { AdminTable, PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { AssignCourseDialog, CreateStudentDialog, StudentRowActions, StudentStatusButton } from "@/components/admin/student-actions"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Students | Builtbyskills Admin",
}

export default async function AdminStudentsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const studentOptions = result.data.students.map((student) => ({ value: student.id, label: `${student.full_name} (${student.email})` }))
  const courseOptions = result.data.courses.map((course) => ({ value: course.id, label: course.title }))

  return (
    <>
      <PageHeader
        title="Students"
        description="Create student accounts, view access status, and assign one or more courses with optional start and expiry dates."
        action={
          <div className="flex flex-wrap gap-2">
            <AssignCourseDialog studentOptions={studentOptions} courseOptions={courseOptions} />
            <CreateStudentDialog />
          </div>
        }
      />
      <AdminTable
        columns={["Name", "Email", "Phone", "Status", "Created", "Actions"]}
        rows={result.data.students.map((student) => [
          student.full_name,
          student.email,
          student.phone ?? "Not set",
          <StudentStatusButton key={student.id} student={student} />,
          formatDate(student.created_at),
          <StudentRowActions key={student.id} student={student} />,
        ])}
      />
    </>
  )
}
