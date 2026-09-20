import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { render, screen } from "@/test/utils/render"

vi.mock("@/actions/admin", () => ({
  assignCourseAction: vi.fn(async () => ({ ok: true, message: "Course assignment saved." })),
  createStudentAction: vi.fn(async () => ({ ok: true, message: "Student created." })),
  updateStudentAction: vi.fn(async () => ({ ok: true, message: "Student updated." })),
  updateStudentStatusAction: vi.fn(async () => ({ ok: true, message: "Student status updated." })),
  deleteStudentAction: vi.fn(async () => ({ ok: true, message: "Student permanently deleted." })),
}))

import { AssignCourseDialog, CreateStudentDialog, StudentRowActions, StudentStatusButton } from "@/components/admin/student-actions"
import type { Profile } from "@/types/lms"

const student = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  full_name: "Mubarra Bashir",
  email: "mubarra@example.com",
  phone: "03117310213",
  whatsapp: "03117310213",
  status: "active",
} satisfies Pick<Profile, "id" | "full_name" | "email" | "phone" | "whatsapp" | "status">

describe("CreateStudentDialog", () => {
  it("opens the create student modal from the header button", async () => {
    const user = userEvent.setup()
    render(<CreateStudentDialog />)

    await user.click(screen.getByRole("button", { name: "Create student" }))

    expect(screen.getByRole("dialog", { name: "Create student" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Full name" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("type", "email")
  })
})

describe("AssignCourseDialog", () => {
  it("opens the assign course modal from the header button", async () => {
    const user = userEvent.setup()
    render(
      <AssignCourseDialog
        studentOptions={[{ value: student.id, label: `${student.full_name} (${student.email})` }]}
        courseOptions={[{ value: "course-1", label: "Basic english learning" }]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Assign course" }))

    expect(screen.getByRole("dialog", { name: "Assign course" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Student" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Course" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Enrollment status" })).toBeInTheDocument()
    expect(screen.getByLabelText("Starts at")).toHaveAttribute("type", "datetime-local")
    expect(screen.getByLabelText("Expires at")).toHaveAttribute("type", "datetime-local")
  })
})

describe("StudentStatusButton", () => {
  it("opens a status popup with active and inactive choices", async () => {
    const user = userEvent.setup()
    render(<StudentStatusButton student={student} />)

    await user.click(screen.getByRole("button", { name: "Change status for Mubarra Bashir" }))

    expect(screen.getByRole("dialog", { name: "Change status" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("active")
    expect(screen.getByRole("option", { name: "active" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "inactive" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "suspended" })).not.toBeInTheDocument()
  })
})

describe("StudentRowActions", () => {
  it("shows edit and delete options from the three-dot menu", async () => {
    const user = userEvent.setup()
    render(<StudentRowActions student={student} />)

    await user.click(screen.getByRole("button", { name: "Open actions for Mubarra Bashir" }))

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })

  it("opens a prefilled edit modal with read-only email", async () => {
    const user = userEvent.setup()
    render(<StudentRowActions student={student} />)

    await user.click(screen.getByRole("button", { name: "Open actions for Mubarra Bashir" }))
    await user.click(screen.getByRole("button", { name: "Edit" }))

    expect(screen.getByRole("dialog", { name: "Edit student" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveValue("Mubarra Bashir")
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("mubarra@example.com")
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("readonly")
  })

  it("opens the permanent delete confirmation from the delete option", async () => {
    const user = userEvent.setup()
    render(<StudentRowActions student={student} />)

    await user.click(screen.getByRole("button", { name: "Open actions for Mubarra Bashir" }))
    await user.click(screen.getByRole("button", { name: "Delete" }))

    expect(screen.getByRole("dialog", { name: "Delete student" })).toBeInTheDocument()
    expect(screen.getByText(/permanently remove the student from the table/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete student" })).toBeInTheDocument()
  })
})
