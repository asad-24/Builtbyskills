"use client"
import Link from "next/link"
import { useActionState, useState } from "react"
import { createLessonAction, updateLessonAction, createSectionAction, updateSectionAction } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { isYouTubeVideoId } from "@/lib/lessons/youtube"
import { LessonResources, type LessonResource } from "@/components/admin/lesson-resources"
import { LessonVideoUpload, type PendingVideoUpload } from "@/components/admin/lesson-video-upload"
import type { LessonType, LessonStatus } from "@/types/lms"

export type EditableLesson = { id: string; updated_at: string; title: string; description: string | null; lesson_type: LessonType; status: LessonStatus; is_preview: boolean; youtube_video_id?: string | null; video_asset_id?: string | null; video_source?: string; video_upload?: PendingVideoUpload }
const control = "min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
const types = { video: "Video", text: "Text lesson", pdf_resource: "PDF or downloadable file", external_resource: "External link or video link", live_class: "Live class information" }

export function LessonEditor({ lesson, sections, content }: { lesson?: EditableLesson; sections?: { id: string; title: string }[]; content?: { legacyVideo?: boolean; resources: LessonResource[] } }) {
  const [values, setValues] = useState({ title: lesson?.title ?? "", description: lesson?.description ?? "", lesson_type: lesson?.lesson_type ?? "video", status: lesson?.status ?? "draft", section_id: sections?.[0]?.id ?? "", youtube_url: isYouTubeVideoId(lesson?.youtube_video_id) ? `https://www.youtube.com/watch?v=${lesson.youtube_video_id}` : "" })
  const [state, action, pending] = useActionState(async (previous: { ok: boolean; message: string } | undefined, data: FormData) => {
    const result = await (lesson ? updateLessonAction : createLessonAction)(previous, data)
    if (result.ok && !lesson) setValues({ ...values, title: "", description: "", status: "draft", youtube_url: "" })
    return result
  }, undefined)
  return <div className="grid min-w-0 gap-5"><form action={action} className="grid min-w-0 gap-4">
    <p className="rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">
      {lesson?.status === "published" ? "Published — available to students with active enrollment." : lesson?.status === "archived" ? "Archived — hidden from students." : "Draft — hidden from students. Add your content, choose Published under Visibility, then save the lesson to make it available."}
    </p>
    {lesson ? <><input type="hidden" name="id" value={lesson.id} /><input type="hidden" name="updated_at" value={lesson.updated_at} /></> : null}
    <fieldset disabled={pending} className="grid min-w-0 gap-4" aria-busy={pending}>
      {!lesson ? <label className="grid gap-1.5 text-sm font-medium">Section<select required name="section_id" className={control} value={values.section_id} onChange={event => setValues({ ...values, section_id: event.target.value })}>{sections?.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label> : null}
      <label className="grid gap-1.5 text-sm font-medium">Lesson title<input required minLength={3} maxLength={200} name="title" className={control} value={values.title} onChange={event => setValues({ ...values, title: event.target.value })} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Content type<select name="lesson_type" className={control} value={values.lesson_type} onChange={event => setValues({ ...values, lesson_type: event.target.value as LessonType })}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-medium">{values.lesson_type === "text" ? "Lesson text" : "Description"}<textarea rows={values.lesson_type === "text" ? 10 : 3} name="description" className={control} value={values.description} onChange={event => setValues({ ...values, description: event.target.value })} /></label>
      {values.lesson_type === "video" && lesson?.youtube_video_id && !lesson.video_asset_id && lesson.video_source !== "r2" ? <div className="grid gap-2">
        <label className="grid gap-1.5 text-sm font-medium">YouTube video link<input type="url" name="youtube_url" className={control} value={values.youtube_url} onChange={event => setValues({ ...values, youtube_url: event.target.value })} placeholder="https://www.youtube.com/watch?v=..." aria-describedby={`video-help-${lesson?.id ?? "new"}`} /></label>
        <p id={`video-help-${lesson?.id ?? "new"}`} className="text-sm text-slate-600">Your existing YouTube lesson keeps working during the private-video rollout. Choose a replacement below when ready.</p>
        {content?.legacyVideo && !lesson?.youtube_video_id ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This lesson needs a YouTube video link before students can watch it. Paste the replacement link and save.</p> : null}
        {values.youtube_url ? <Button type="button" variant="outline" onClick={() => setValues({ ...values, youtube_url: "", status: values.status === "published" ? "draft" : values.status })}>Remove video link</Button> : null}
        {lesson?.youtube_video_id && !values.youtube_url ? <p className="text-sm text-slate-600">Save to remove the video link. Keep this lesson Draft or Archived until you add a replacement.</p> : null}
      </div> : null}
      {values.lesson_type === "video" && !lesson ? <p className="text-sm text-slate-600">Create this lesson as a draft first, then choose its video below. Publish after the video is Ready.</p> : null}
      {values.lesson_type === "video" && lesson && content?.legacyVideo && !lesson.youtube_video_id && !lesson.video_asset_id ? <p className="text-sm text-slate-600">Choose a private video below to replace this lesson&apos;s historical video.</p> : null}
      {values.lesson_type === "text" ? <p className="text-xs text-slate-500">Plain text with paragraphs and line breaks. HTML is displayed as text.</p> : null}
      {values.lesson_type === "live_class" ? <p className="text-sm text-slate-600">Use this lesson for class information. Schedule the meeting separately in <Link className="underline" href="/admin/live-classes">Live Classes</Link> for this course.</p> : null}
      {!lesson && ["pdf_resource", "external_resource"].includes(values.lesson_type) ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Create this lesson as a draft first. Then find it in its section and {values.lesson_type === "pdf_resource" ? "choose a PDF or file from your device" : "enter a link title and URL"}. Once the content is ready, set Visibility to Published and save.</p> : null}
      <label className="grid gap-1.5 text-sm font-medium">Visibility<select name="status" className={control} value={values.status} onChange={event => setValues({ ...values, status: event.target.value as LessonStatus })}><option value="draft">Draft - hidden from students</option><option value="published">Published - available to enrolled students</option><option value="archived">Archived - hidden from students</option></select></label>
      {lesson?.is_preview ? <p className="text-xs text-slate-500">The existing preview designation is retained. Access still requires active enrollment; public preview playback is unavailable.</p> : null}
      {state ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      <Button disabled={pending || (!lesson && !sections?.length)} type="submit">{pending ? "Saving..." : lesson ? "Save lesson" : "Create lesson"}</Button>
    </fieldset>
  </form>
    {lesson && content ? values.lesson_type !== lesson.lesson_type ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Save lesson to confirm the new content type. Then you can add its content below. Your existing attachments are retained.</p> : <div className="grid min-w-0 gap-4">
      <h3 className="text-base font-semibold">Lesson content</h3>
      {lesson.lesson_type === "video" ? <LessonVideoUpload lessonId={lesson.id} updatedAt={lesson.updated_at} privateAttached={!!lesson.video_asset_id} attached={!!lesson.video_asset_id || (lesson.video_source !== "r2" && !!lesson.youtube_video_id)} existingUpload={lesson.video_upload} /> : null}
      {lesson.lesson_type === "text" ? <p className="text-sm text-slate-600">Write your content in Lesson text above, then save the lesson.</p> : null}
      {lesson.lesson_type === "live_class" ? <p className="text-sm text-slate-600">Add class information in Description above, then use Live Classes to schedule the meeting.</p> : null}
      <LessonResources lessonId={lesson.id} external={lesson.lesson_type === "external_resource"} resources={content.resources} optional={!["pdf_resource", "external_resource"].includes(lesson.lesson_type)} />
    </div> : null}
  </div>
}


export function SectionEditor({ courseId, section }: { courseId: string; section?: { id: string; updated_at?: string; title: string; description: string | null } }) {
  const [title, setTitle] = useState(section?.title ?? "")
  const [description, setDescription] = useState(section?.description ?? "")
  const [state, action, pending] = useActionState(async (previous: { ok: boolean; message: string } | undefined, data: FormData) => {
    const result = await (section ? updateSectionAction : createSectionAction)(previous, data)
    if (result.ok && !section) { setTitle(""); setDescription("") }
    return result
  }, undefined)
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="course_id" value={courseId} />
    {section ? <><input type="hidden" name="id" value={section.id} /><input type="hidden" name="updated_at" value={section.updated_at ?? ""} /></> : null}
    <fieldset disabled={pending} aria-busy={pending} className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">Section title<input name="title" required minLength={3} className={control} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Description<textarea name="description" rows={3} className={control} value={description} onChange={event => setDescription(event.target.value)} /></label>
      {state ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      <Button disabled={pending} type="submit">{pending ? "Saving..." : section ? "Save section" : "Add section"}</Button>
    </fieldset>
  </form>
}
