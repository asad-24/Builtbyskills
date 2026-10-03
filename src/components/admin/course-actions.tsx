"use client"

import { useId, useState, type ReactNode } from "react"
import { Plus, X } from "lucide-react"

import { deleteCourseAction } from "@/actions/admin"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { CourseDetailsForm } from "@/components/admin/course-details-form"
import { Button } from "@/components/ui/button"

type SelectOption = { value: string; label: string }

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
          <CourseDetailsForm instructorOptions={instructorOptions} />
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

export function DeleteCourse({ id, title }: { id: string; title: string }) {
  return <ConfirmAction title={`Delete ${title}?`} description="Permanently delete this course? This cannot be undone." action={async (_, data) => {
    await deleteCourseAction(data)
    return { ok: true, message: "Course deleted." }
  }}>
    <input type="hidden" name="id" value={id} />
  </ConfirmAction>
}
