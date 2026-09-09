import { assignCourseAction, createStudentAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextField } from "@/components/admin/admin-ui"
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
      <PageHeader title="Students" description="Create student accounts, view access status, and assign one or more courses with optional start and expiry dates." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Name", "Email", "Phone", "Status", "Created"]}
          rows={result.data.students.map((student) => [
            student.full_name,
            student.email,
            student.phone ?? "Not set",
            <StatusBadge key={student.id}>{student.status}</StatusBadge>,
            formatDate(student.created_at),
          ])}
        />
        <div className="grid gap-6">
          <Panel title="Create student">
            <ActionForm action={createStudentAction} submitLabel="Create student">
              <TextField name="full_name" label="Full name" required />
              <TextField name="email" label="Email" type="email" required />
              <TextField name="phone" label="Phone" />
              <TextField name="whatsapp" label="WhatsApp" />
              <SelectField name="status" label="Status" options={["active", "inactive", "suspended"].map((value) => ({ value, label: value }))} />
            </ActionForm>
          </Panel>
          <Panel title="Assign course">
            <ActionForm action={assignCourseAction} submitLabel="Save assignment">
              <SelectField name="student_id" label="Student" options={studentOptions} />
              <SelectField name="course_id" label="Course" options={courseOptions} />
              <SelectField name="status" label="Enrollment status" options={["active", "pending", "suspended", "completed", "expired", "cancelled"].map((value) => ({ value, label: value }))} />
              <TextField name="starts_at" label="Starts at" type="datetime-local" />
              <TextField name="expires_at" label="Expires at" type="datetime-local" />
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  )
}
