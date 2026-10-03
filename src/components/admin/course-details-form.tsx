"use client"

import { useState } from "react"
import { createCourseDraftAction, updateCourseAction, updateCoursePublicationAction } from "@/actions/admin"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { ActionForm } from "@/components/admin/action-form"
import { SelectField, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { ThumbnailUploadInput } from "@/components/admin/thumbnail-upload-input"
import { Button } from "@/components/ui/button"
import type { Course } from "@/types/lms"

type Option = { value: string; label: string }

export function CourseDetailsForm({ course, instructorOptions }: { course?: Course; instructorOptions: Option[] }) {
  const displayedInstructors = course?.instructor_id && !instructorOptions.some(option => option.value === course.instructor_id)
    ? [...instructorOptions, { value: course.instructor_id, label: "Current instructor (not in list)" }]
    : instructorOptions
  return (
    <ActionForm action={course ? updateCourseAction : createCourseDraftAction} submitLabel={course ? "Save course details" : "Save draft and add lessons"}>
      {course ? <input type="hidden" name="id" value={course.id} /> : <p className="text-sm text-slate-600">Save your course privately, then add sections and lessons in Course Builder.</p>}
      <TextField name="title" label="Course name" defaultValue={course?.title} required />
      <TextField name="short_description" label="Brief summary" defaultValue={course?.short_description} required placeholder="A quick introduction shown in the course catalog" />
      <TextAreaField name="description" label="About this course" defaultValue={course?.description} required />
      <fieldset className="grid gap-3"><legend className="mb-2 text-sm font-semibold text-slate-800">Course image</legend><ThumbnailUploadInput name="thumbnail_url" defaultValue={course?.thumbnail_url} /></fieldset>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Course fee ({course?.currency ?? "PKR"})
        <input name="price" type="number" min="0" step="0.01" required defaultValue={course?.price ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
        <span className="text-xs font-normal text-slate-500">Enter 0 for a free course.</span>
      </label>
      <details className="rounded-lg border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Additional details (optional)</summary>
        <div className="mt-4 grid gap-4">
          <TextField name="category" label="Category" defaultValue={course?.category} />
          <TextField name="level" label="Who is this for?" defaultValue={course?.level} />
          <TextField name="duration_text" label="Course length" defaultValue={course?.duration_text} placeholder="For example, 6 weeks" />
          <SelectField name="instructor_id" label="Displayed instructor" defaultValue={course?.instructor_id} options={displayedInstructors} />
          <p className="text-xs text-slate-500">This selects the course’s displayed instructor. Instructor access is managed separately.</p>
          <LearningOutcomes initial={course?.outcomes ?? []} />
          <SelectField name="featured" label="Show first in course catalog" defaultValue={course?.featured ? "true" : "false"} options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]} />
        </div>
      </details>
    </ActionForm>
  )
}

function LearningOutcomes({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial)
  return <fieldset className="grid gap-2">
    <legend className="mb-2 text-sm font-medium text-slate-700">What students will learn</legend>
    {items.map((item, index) => <div key={index} className="flex items-center gap-2">
      <input aria-label={`Learning outcome ${index + 1}`} value={item} onChange={event => setItems(items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
      <Button type="button" variant="ghost" aria-label={`Remove learning outcome ${index + 1}`} onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
    </div>)}
    <Button type="button" variant="outline" onClick={() => setItems([...items, ""])}>Add learning outcome</Button>
    <input type="hidden" name="outcomes" value={items.join("\n")} />
  </fieldset>
}

export function CoursePublication({ course }: { course: Course }) {
  const labels = { draft: "Draft — not public", published: "Published — open for enrollment", unpublished: "Unpublished — not public", archived: "Archived — not public" }
  const actions = [{ status: "published", label: "Publish course" }, { status: "unpublished", label: "Unpublish course" }, { status: "archived", label: "Archive course" }, { status: "draft", label: "Save as draft" }]
  return <div className="grid gap-4">
    <p className="text-sm font-semibold text-slate-800">{labels[course.status]}</p>
    <p className="text-sm text-slate-600">Publishing makes this course available in the catalog and opens enrollment. Unpublishing or archiving hides it from the public; it does not remove access for enrolled students.</p>
    {course.slug ? <p className="break-all text-sm text-slate-600">Course link: <span>/courses/{course.slug}</span></p> : null}
    <div className="grid gap-3 sm:grid-cols-2">{actions.filter(action => action.status !== course.status).map(action => action.status === "archived" ? <ConfirmAction key={action.status} action={updateCoursePublicationAction} triggerLabel="Archive course" confirmLabel="Confirm archive" title={`Archive ${course.title}?`} description="This hides the course from the public catalog. Enrolled students retain access.">
      <input type="hidden" name="id" value={course.id} /><input type="hidden" name="status" value="archived" />
    </ConfirmAction> : <ActionForm key={action.status} action={updateCoursePublicationAction} submitLabel={action.label}>
      <input type="hidden" name="id" value={course.id} /><input type="hidden" name="status" value={action.status} />
    </ActionForm>)}</div>
  </div>
}
