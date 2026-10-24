import { assignCourseAction } from "@/actions/admin"
import { manageInstructorAssignmentAction } from "@/actions/portal-admin"
import { ActionForm } from "@/components/admin/action-form"
import { Panel, SelectField, TextField } from "@/components/admin/admin-ui"

type Option = { value: string; label: string }
export function InstructorAssignmentForm({ courses, instructors }: { courses: Option[]; instructors: Option[] }) {
  return <Panel title="Assign or remove a teacher"><ActionForm action={manageInstructorAssignmentAction} submitLabel="Save teacher access">
    <SelectField name="course_id" label="Course" options={courses} />
    <SelectField name="instructor_id" label="Teacher" options={instructors} />
    <SelectField name="assigned" label="Course access" options={[{ value: "true", label: "Assign course" }, { value: "false", label: "Remove assignment" }]} />
  </ActionForm></Panel>
}
export function EnrollmentManagementForm({ courses, students, enrollment }: {
  courses: Option[]; students: Option[]
  enrollment?: { student_id: string; course_id: string; status: string; starts_at: string | null; expires_at: string | null }
}) {
  return <Panel title={enrollment ? "Manage enrollment" : "Enroll a student"}><ActionForm action={assignCourseAction} submitLabel="Save enrollment access">
    {enrollment ? <><input type="hidden" name="student_id" value={enrollment.student_id} /><input type="hidden" name="course_id" value={enrollment.course_id} /></> : <><SelectField name="student_id" label="Student" options={students} /><SelectField name="course_id" label="Course" options={courses} /></>}
    <SelectField name="status" label="Enrollment status" defaultValue={enrollment?.status ?? "pending"} options={[
      { value: "pending", label: "Pending approval" }, { value: "active", label: "Approved — active access" },
      { value: "suspended", label: "Suspended — no access" }, { value: "cancelled", label: "Rejected / cancelled — no access" },
      { value: "completed", label: "Completed — no access" }, { value: "expired", label: "Expired — no access" },
    ]} />
    <TextField name="starts_at" label="Access starts (ISO date/time with timezone, optional)" defaultValue={enrollment?.starts_at} placeholder="2026-11-01T09:00:00+05:00" />
    <TextField name="expires_at" label="Access expires (ISO date/time with timezone, optional)" defaultValue={enrollment?.expires_at} placeholder="2027-01-01T09:00:00+05:00" />
  </ActionForm></Panel>
}
