import { createLiveClassAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Live Classes | Builtbyskills Admin",
}

export default async function AdminLiveClassesPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const courseOptions = result.data.courses.map((course) => ({ value: course.id, label: course.title }))
  const instructorOptions = [
    { value: "", label: "No instructor" },
    ...result.data.instructors.map((instructor) => ({ value: instructor.id, label: instructor.full_name })),
  ]

  return (
    <>
      <PageHeader title="Live Classes" description="Schedule Zoom, Google Meet, or external live sessions for enrolled students." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Title", "Course", "Instructor", "Provider", "Status", "Starts"]}
          rows={result.data.liveClasses.map((item) => [
            item.title,
            item.course?.title ?? "Unknown course",
            item.instructor?.full_name ?? "Not assigned",
            item.meeting_provider,
            <StatusBadge key={item.id}>{item.status}</StatusBadge>,
            formatDate(item.starts_at),
          ])}
        />
        <Panel title="Schedule live class">
          <ActionForm action={createLiveClassAction} submitLabel="Create live class">
            <SelectField name="course_id" label="Course" options={courseOptions} />
            <SelectField name="instructor_id" label="Instructor" options={instructorOptions} />
            <TextField name="title" label="Title" required />
            <TextAreaField name="description" label="Description" rows={3} />
            <SelectField name="meeting_provider" label="Provider" options={[
              { value: "zoom", label: "Zoom" },
              { value: "google_meet", label: "Google Meet" },
              { value: "other", label: "Other" },
            ]} />
            <TextField name="meeting_url" label="Meeting URL" type="url" required />
            <TextField name="starts_at" label="Starts at" type="datetime-local" required />
            <TextField name="ends_at" label="Ends at" type="datetime-local" />
            <SelectField name="status" label="Status" options={["scheduled", "live", "completed", "cancelled"].map((value) => ({ value, label: value }))} />
          </ActionForm>
        </Panel>
      </div>
    </>
  )
}
