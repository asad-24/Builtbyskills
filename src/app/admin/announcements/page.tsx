import { createAnnouncementAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Announcements | Builtbyskills Admin",
}

export default async function AdminAnnouncementsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const courseOptions = [
    { value: "", label: "All students" },
    ...result.data.courses.map((course) => ({ value: course.id, label: course.title })),
  ]

  return (
    <>
      <PageHeader title="Announcements" description="Publish updates to a specific course or the full academy audience." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Title", "Course", "Published", "Created"]}
          rows={result.data.announcements.map((item) => [
            item.title,
            item.course?.title ?? "All students",
            <StatusBadge key={item.id}>{item.is_published ? "published" : "draft"}</StatusBadge>,
            formatDate(item.created_at),
          ])}
        />
        <Panel title="Create announcement">
          <ActionForm action={createAnnouncementAction} submitLabel="Create announcement">
            <SelectField name="course_id" label="Course" options={courseOptions} />
            <TextField name="title" label="Title" required />
            <TextAreaField name="content" label="Content" required rows={5} />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="is_published" value="true" className="size-4 rounded border-slate-300" />
              Publish now
            </label>
          </ActionForm>
        </Panel>
      </div>
    </>
  )
}
