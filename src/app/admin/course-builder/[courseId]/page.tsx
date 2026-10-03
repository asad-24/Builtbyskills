import { CourseDetailsForm, CoursePublication } from "@/components/admin/course-details-form"
import { PageHeader, Panel } from "@/components/admin/admin-ui"
import { LessonEditor, SectionEditor } from "@/components/admin/lesson-editor"
import { safeExternalUrl } from "@/lib/validations/course-builder"
import { getCourseBuilderData } from "@/features/admin/data"

export const metadata = {
  title: "Course Builder | Builtbyskills Admin",
}

export default async function CourseBuilderPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const result = await getCourseBuilderData(courseId)

  if (!result.ok) return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">The course builder is unavailable. Please sign in with an admin account or try again.</p>

  const { course, instructors, sections } = result.data
  const instructorOptions = [
    { value: "", label: "No instructor" },
    ...instructors.map((instructor) => ({ value: instructor.id, label: instructor.full_name })),
  ]
  const sectionOptions = sections.map(section => ({ id: section.id, title: section.title }))

  return (
    <>
      <PageHeader title={`Course Builder: ${course.title}`} description="Manage course details, sections, and lessons. New content is added at the end automatically." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="grid min-w-0 gap-6">
          <Panel title="Course details">
            <CourseDetailsForm key={course.updated_at} course={course} instructorOptions={instructorOptions} />
          </Panel>
          <Panel title="Publication"><CoursePublication course={course} /></Panel>
          <Panel title="Add section"><SectionEditor courseId={course.id} /></Panel>
          <Panel title="Add lesson">
            {sections.length ? <LessonEditor sections={sectionOptions} /> : <p className="text-sm text-slate-600">Add your first section, then create lessons inside it.</p>}
          </Panel>
        </div>
        <div className="grid min-w-0 gap-6">
          <p className="text-sm font-medium text-slate-700">Add your content below each lesson. Choose a private video or file from your device, enter an external link, or write lesson text. Save changes before publishing.</p>
          <p className="text-sm text-slate-600">Draft and archived lessons are hidden from students. Published lessons require active enrollment. Public preview playback is unavailable.</p>
          {sections.map((section, sectionIndex) => (
            <Panel key={section.id} title={`${sectionIndex + 1}. ${section.title}`}>
              <p className="mb-4 text-sm text-slate-500">{section.description}</p>
              <details className="mb-5"><summary className="cursor-pointer text-sm font-semibold">Edit section</summary><div className="mt-3"><SectionEditor key={`section-editor:${section.id}:${section.updated_at ?? ""}`} courseId={course.id} section={section} /></div></details>
              {(section.lessons ?? []).length === 0 ? <p className="text-sm text-slate-500">No lessons yet. Add a lesson using the form.</p> : null}
              <div className="grid gap-4">
                {(section.lessons ?? []).map((lesson, index) => <details open key={lesson.id} className="min-w-0 rounded-lg border border-slate-200 p-4">
                  <summary className="cursor-pointer break-words text-sm font-semibold">{index + 1}. {lesson.title} <span className="ml-2 font-normal capitalize text-slate-500">{lesson.status}</span><span className="block font-normal text-slate-600">Edit lesson and add content</span></summary>
                  <div className="mt-4 grid gap-5">
                    <LessonEditor key={`lesson-editor:${lesson.id}:${lesson.updated_at ?? ""}`} lesson={{ id: lesson.id, updated_at: lesson.updated_at ?? "", title: lesson.title, description: lesson.description, lesson_type: lesson.lesson_type, status: lesson.status, is_preview: lesson.is_preview, youtube_video_id: lesson.youtube_video_id, video_asset_id: lesson.video_asset_id, video_source: lesson.video_source, video_upload: lesson.video_upload }} content={{ legacyVideo: !!(lesson.mux_playback_id || lesson.mux_asset_id || lesson.mux_upload_id), resources: (lesson.lesson_resources ?? []).map(resource => ({ id: resource.id, title: resource.title, resource_type: resource.resource_type, url: resource.resource_type === "external_link" ? safeExternalUrl(resource.file_path) ?? undefined : undefined })) }} />
                  </div>
                </details>)}
              </div>
            </Panel>
          ))}

        </div>
      </div>
    </>
  )
}
