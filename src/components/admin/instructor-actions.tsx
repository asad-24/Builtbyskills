"use client"

import { useId, useState, type ReactNode } from "react"
import { Plus, X } from "lucide-react"

import { createInstructorAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { SelectField, TextField } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"

const instructorStatusOptions = ["active", "inactive", "suspended"].map((value) => ({
  value,
  label: value,
}))

export function CreateInstructorDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create instructor
      </Button>
      {open ? (
        <InstructorModal title="Create instructor" onClose={() => setOpen(false)}>
          <ActionForm action={createInstructorAction} submitLabel="Create instructor">
            <TextField name="full_name" label="Full name" required />
            <TextField name="email" label="Email" type="email" required />
            <SelectField name="status" label="Status" defaultValue="active" options={instructorStatusOptions} />
          </ActionForm>
        </InstructorModal>
      ) : null}
    </>
  )
}

function InstructorModal({
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
        className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
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
