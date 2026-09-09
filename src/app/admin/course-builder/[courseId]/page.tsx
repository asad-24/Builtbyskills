import { createLessonAction, createSectionAction, updateCourseAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { getCourseBuilderData } from "@/features/admin/data"

export const metadata = {
  title: "Course Builder | Builtbyskills Admin",
}

export default async function CourseBuilderPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const result = await getCourseBuilderData(courseId)

  if (!result.ok) return <SetupNotice message={result.message} />

  const { course, instructors, sections } = result.data
  const instructorOptions = [
    { value: "", label: "No instructor" },
    ...instructors.map((instructor) => ({ value: instructor.id, label: instructor.full_name })),
  ]
  const sectionOptions = sections.map((section) => ({ value: section.id, label: `${section.position}. ${section.title}` }))

  return (
    <>
      <PageHeader title={`Course Builder: ${course.title}`} description="Edit course metadata and add ordered sections and lessons. Video uploads use Mux direct-upload routes." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="grid gap-6">
          <Panel title="Course metadata">
            <ActionForm action={updateCourseAction} submitLabel="Update course">
              <input type="hidden" name="id" value={course.id} />
              <TextField name="title" label="Course title" defaultValue={course.title} required />
              <TextField name="slug" label="Slug" defaultValue={course.slug} required />
              <TextField name="short_description" label="Short description" defaultValue={course.short_description} required />
              <TextAreaField name="description" label="Full description" defaultValue={course.description} required />
              <TextField name="thumbnail_url" label="Thumbnail URL" defaultValue={course.thumbnail_url} />
              <TextField name="category" label="Category" defaultValue={course.category} required />
              <TextField name="level" label="Level" defaultValue={course.level} required />
              <TextField name="duration_text" label="Duration" defaultValue={course.duration_text} />
              <TextField name="price" label="Price" type="number" defaultValue={course.price} required />
              <TextField name="currency" label="Currency" defaultValue={course.currency} required />
              <SelectField name="status" label="Status" defaultValue={course.status} options={["draft", "published", "unpublished", "archived"].map((value) => ({ value, label: value }))} />
              <SelectField name="instructor_id" label="Instructor" defaultValue={course.instructor_id} options={instructorOptions} />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name="featured" value="true" defaultChecked={course.featured} className="size-4 rounded border-slate-300" />
                Featured course
              </label>
              <TextAreaField name="outcomes" label="Outcomes, one per line" defaultValue={course.outcomes?.join("\n")} rows={3} />
              <TextAreaField name="requirements" label="Requirements, one per line" defaultValue={course.requirements?.join("\n")} rows={3} />
            </ActionForm>
          </Panel>
          <Panel title="Add section">
            <ActionForm action={createSectionAction} submitLabel="Add section">
              <input type="hidden" name="course_id" value={course.id} />
              <TextField name="title" label="Section title" required />
              <TextAreaField name="description" label="Description" rows={3} />
              <TextField name="position" label="Position" type="number" defaultValue={sections.length + 1} required />
            </ActionForm>
          </Panel>
          <Panel title="Add lesson">
            <ActionForm action={createLessonAction} submitLabel="Add lesson">
              <SelectField name="section_id" label="Section" options={sectionOptions} />
              <TextField name="title" label="Lesson title" required />
              <TextField name="slug" label="Slug" required />
              <TextAreaField name="description" label="Description" rows={3} />
              <SelectField name="lesson_type" label="Lesson type" options={[
                { value: "video", label: "Video" },
                { value: "text", label: "Text" },
                { value: "pdf_resource", label: "PDF/resource" },
                { value: "live_class", label: "Live class" },
                { value: "external_resource", label: "External resource" },
              ]} />
              <TextField name="mux_asset_id" label="Mux asset ID" />
              <TextField name="mux_playback_id" label="Mux playback ID" />
              <TextField name="duration_seconds" label="Duration seconds" type="number" defaultValue={0} />
              <TextField name="position" label="Position" type="number" defaultValue={1} required />
              <SelectField name="status" label="Status" options={["draft", "published", "archived"].map((value) => ({ value, label: value }))} />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name="is_preview" value="true" className="size-4 rounded border-slate-300" />
                Preview lesson
              </label>
            </ActionForm>
          </Panel>
        </div>
        <div className="grid gap-6">
          {sections.map((section) => (
            <Panel key={section.id} title={`${section.position}. ${section.title}`}>
              <p className="mb-4 text-sm text-slate-500">{section.description}</p>
              <AdminTable
                columns={["Order", "Lesson", "Type", "Status", "Preview", "Mux playback"]}
                rows={(section.lessons ?? []).map((lesson) => [
                  lesson.position,
                  lesson.title,
                  lesson.lesson_type,
                  <StatusBadge key={lesson.id}>{lesson.status}</StatusBadge>,
                  lesson.is_preview ? "Yes" : "No",
                  lesson.mux_playback_id ?? "Not attached",
                ])}
              />
            </Panel>
          ))}
        </div>
      </div>
    </>
  )
}
