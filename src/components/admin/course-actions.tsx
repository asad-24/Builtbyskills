"use client"

import { useId, useState, type ReactNode } from "react"
import { Plus, X } from "lucide-react"

import { createCourseAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { SelectField, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { ThumbnailUploadInput } from "@/components/admin/thumbnail-upload-input"
import { Button } from "@/components/ui/button"

type SelectOption = { value: string; label: string }

const courseStatusOptions = ["draft", "published", "unpublished", "archived"].map((value) => ({
  value,
  label: value,
}))

export function CreateCourseDialog({ instructorOptions }: { instructorOptions: SelectOption[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create course
      </Button>
      {open ? (
        <CourseModal title="Create course" onClose={() => setOpen(false)}>
          <ActionForm action={createCourseAction} submitLabel="Create course">
            <TextField name="title" label="Course title" required />
            <TextField name="slug" label="Slug" required placeholder="shopify-and-tiktok-ads" />
            <TextField name="short_description" label="Short description" required />
            <TextAreaField name="description" label="Full description" required />
            <ThumbnailUploadInput name="thumbnail_url" />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="category" label="Category" required />
              <TextField name="level" label="Level" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="duration_text" label="Duration" />
              <TextField name="price" label="Price" type="number" required />
            </div>
            <TextField name="currency" label="Currency" defaultValue="PKR" required />
            <SelectField name="status" label="Status" options={courseStatusOptions} />
            <SelectField name="instructor_id" label="Instructor" options={instructorOptions} />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="featured" value="true" className="size-4 rounded border-slate-300" />
              Featured course
            </label>
            <TextAreaField name="outcomes" label="Outcomes, one per line" rows={3} />
            <TextAreaField name="requirements" label="Requirements, one per line" rows={3} />
          </ActionForm>
        </CourseModal>
      ) : null}
    </>
  )
}

function CourseModal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const titleId = useId()

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-slate-950">
            {title}
          </h3>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close dialog" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </section>
    </div>
  )
}
