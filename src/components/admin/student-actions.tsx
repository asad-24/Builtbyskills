"use client"

import { useId, useState, type ReactNode } from "react"
import { MoreHorizontal, Plus, X } from "lucide-react"

import {
  assignCourseAction,
  createStudentAction,
  deleteStudentAction,
  updateStudentAction,
  updateStudentStatusAction,
} from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { SelectField, StatusBadge, TextField } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import type { Profile } from "@/types/lms"

type Student = Pick<Profile, "id" | "full_name" | "email" | "phone" | "whatsapp" | "status">
type SelectOption = { value: string; label: string }

const studentStatusOptions = ["active", "inactive", "suspended"].map((value) => ({
  value,
  label: value,
}))

const quickStatusOptions = ["active", "inactive"].map((value) => ({
  value,
  label: value,
}))

const enrollmentStatusOptions = ["active", "pending", "suspended", "completed", "expired", "cancelled"].map((value) => ({
  value,
  label: value,
}))

export function CreateStudentDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create student
      </Button>
      {open ? (
        <StudentModal title="Create student" onClose={() => setOpen(false)}>
          <ActionForm action={createStudentAction} submitLabel="Create student">
            <TextField name="full_name" label="Full name" required />
            <TextField name="email" label="Email" type="email" required />
            <TextField name="phone" label="Phone" />
            <TextField name="whatsapp" label="WhatsApp" />
            <SelectField name="status" label="Status" options={studentStatusOptions} />
          </ActionForm>
        </StudentModal>
      ) : null}
    </>
  )
}

export function AssignCourseDialog({
  studentOptions,
  courseOptions,
}: {
  studentOptions: SelectOption[]
  courseOptions: SelectOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Assign course
      </Button>
      {open ? (
        <StudentModal title="Assign course" onClose={() => setOpen(false)}>
          <ActionForm action={assignCourseAction} submitLabel="Save assignment">
            <SelectField name="student_id" label="Student" options={studentOptions} />
            <SelectField name="course_id" label="Course" options={courseOptions} />
            <SelectField name="status" label="Enrollment status" options={enrollmentStatusOptions} />
            <TextField name="starts_at" label="Starts at" type="datetime-local" />
            <TextField name="expires_at" label="Expires at" type="datetime-local" />
          </ActionForm>
        </StudentModal>
      ) : null}
    </>
  )
}

export function StudentStatusButton({ student }: { student: Student }) {
  const [open, setOpen] = useState(false)
  const defaultStatus = student.status === "active" ? "active" : "inactive"

  return (
    <>
      <button
        type="button"
        className="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-lime-200"
        aria-label={`Change status for ${student.full_name}`}
        onClick={() => setOpen(true)}
      >
        <StatusBadge>{student.status}</StatusBadge>
      </button>
      {open ? (
        <StudentModal title="Change status" onClose={() => setOpen(false)}>
          <ActionForm action={updateStudentStatusAction} submitLabel="Update status">
            <input type="hidden" name="id" value={student.id} />
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-950">{student.full_name}</p>
              <p>{student.email}</p>
            </div>
            <SelectField name="status" label="Status" options={quickStatusOptions} defaultValue={defaultStatus} />
          </ActionForm>
        </StudentModal>
      ) : null}
    </>
  )
}

export function StudentRowActions({ student }: { student: Student }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div className="inline-flex flex-col items-end">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Open actions for ${student.full_name}`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {menuOpen ? (
        <div className="mt-1 min-w-32 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setMenuOpen(false)
              setEditOpen(true)
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="w-full rounded px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            onClick={() => {
              setMenuOpen(false)
              setDeleteOpen(true)
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
      {editOpen ? (
        <StudentModal title="Edit student" onClose={() => setEditOpen(false)}>
          <ActionForm action={updateStudentAction} submitLabel="Save changes">
            <input type="hidden" name="id" value={student.id} />
            <TextField name="full_name" label="Full name" defaultValue={student.full_name} required />
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Email
              <input
                className="h-10 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
                name="email_readonly"
                type="email"
                value={student.email}
                readOnly
              />
            </label>
            <TextField name="phone" label="Phone" defaultValue={student.phone} />
            <TextField name="whatsapp" label="WhatsApp" defaultValue={student.whatsapp} />
            <SelectField name="status" label="Status" options={studentStatusOptions} defaultValue={student.status} />
          </ActionForm>
        </StudentModal>
      ) : null}
      {deleteOpen ? (
        <StudentModal title="Delete student" onClose={() => setDeleteOpen(false)}>
          <ActionForm action={deleteStudentAction} submitLabel="Delete student">
            <input type="hidden" name="id" value={student.id} />
            <p className="text-sm leading-6 text-slate-600">
              This will permanently remove the student from the table. Their course access and progress will be removed, while payment history remains detached.
            </p>
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-950">{student.full_name}</p>
              <p>{student.email}</p>
            </div>
          </ActionForm>
        </StudentModal>
      ) : null}
    </div>
  )
}

function StudentModal({
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
