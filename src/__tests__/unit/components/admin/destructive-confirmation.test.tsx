import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DeleteRecord } from "@/components/admin/record-actions"
import { DeleteCourse } from "@/components/admin/course-actions"
import { CoursePublication } from "@/components/admin/course-details-form"
import { StudentRowActions } from "@/components/admin/student-actions"
import { deleteCourseAction, deleteStudentAction, updateCoursePublicationAction } from "@/actions/admin"
import { deleteContactSubmissionAction, deleteInstructorAction, deletePaymentMethodAction } from "@/actions/admin-records"
import type { Course } from "@/types/lms"

vi.mock("@/actions/admin", () => ({
  deleteCourseAction: vi.fn(), deleteStudentAction: vi.fn(), updateCoursePublicationAction: vi.fn(),
  createCourseDraftAction: vi.fn(), updateCourseAction: vi.fn(), assignCourseAction: vi.fn(),
  createStudentAction: vi.fn(), updateStudentAction: vi.fn(), updateStudentStatusAction: vi.fn(),
}))
vi.mock("@/actions/admin-records", () => ({
  deleteInstructorAction: vi.fn(), deleteContactSubmissionAction: vi.fn(), deletePaymentMethodAction: vi.fn(), updateInstructorAction: vi.fn(),
}))

const id = "11111111-1111-4111-8111-111111111111"
const updatedAt = "2026-10-02T12:00:00.000Z"
const student = { id, full_name: "Selected student", email: "student@example.com", phone: null, whatsapp: null, status: "active" as const }
const cases = [
  { name: "Instructor retirement", action: deleteInstructorAction, element: () => <DeleteRecord id={id} updatedAt={updatedAt} label="instructor" description="Retire this instructor and preserve history." action={deleteInstructorAction} /> },
  { name: "Contact submission", action: deleteContactSubmissionAction, element: () => <DeleteRecord id={id} updatedAt={updatedAt} label="submission" description="Delete only this submission." action={deleteContactSubmissionAction} /> },
  { name: "Payment method", action: deletePaymentMethodAction, element: () => <DeleteRecord id={id} updatedAt={updatedAt} label="method" description="Referenced methods cannot be deleted." action={deletePaymentMethodAction} /> },
  { name: "Course", action: deleteCourseAction, element: () => <DeleteCourse id={id} title="Selected course" /> },
  { name: "Student", action: deleteStudentAction, element: () => <StudentRowActions student={student} /> },
  { name: "Course archive", action: updateCoursePublicationAction, element: () => <CoursePublication course={{ id, title: "Selected course", status: "published", slug: "selected" } as Course} /> },
]
beforeEach(() => vi.resetAllMocks())

describe.each(cases)("$name confirmation", ({ name, action, element }) => {
  async function open(user: ReturnType<typeof userEvent.setup>) {
    if (name === "Student") await user.click(screen.getByRole("button", { name: "Open actions for Selected student" }))
    await user.click(screen.getByRole("button", { name: name === "Course archive" ? "Archive course" : "Delete" }))
  }
  it.each([375, 1440])("opens and cancels without mutation at viewport %i, traps and restores keyboard focus", async width => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width })
    const user = userEvent.setup()
    render(element())
    await open(user)
    expect(action).not.toHaveBeenCalled()
    const dialog = screen.getByRole("alertdialog")
    expect(dialog).toHaveAccessibleDescription()
    expect(dialog.className).toContain("max-h-[90dvh]")
    expect(dialog.className).toContain("w-[calc(100%-2rem)]")
    const cancel = screen.getByRole("button", { name: "Cancel" })
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole("button", { name: /Confirm/ })).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: name === "Student" ? "Open actions for Selected student" : name === "Course archive" ? "Archive course" : "Delete" })).toHaveFocus()
    await open(user)
    await user.keyboard("{Escape}")
    expect(action).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("confirms once with selected identity, blocks repeated submits and dismissal while pending", async () => {
    let finish!: (value: { ok: boolean; message: string }) => void
    vi.mocked(action).mockImplementation(() => new Promise(resolve => { finish = resolve }) as never)
    const user = userEvent.setup()
    render(element())
    await open(user)
    const confirm = screen.getByRole("button", { name: /Confirm/ })
    const form = confirm.closest("form")!
    act(() => { fireEvent.submit(form); fireEvent.submit(form) })
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(confirm).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    await user.keyboard("{Escape}")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    fireEvent.submit(form)
    expect(action).toHaveBeenCalledTimes(1)
    const data = vi.mocked(action).mock.calls[0][name === "Course" ? 0 : 1] as FormData
    expect(data.get("id")).toBe(id)
    if (["Instructor retirement", "Contact submission", "Payment method"].includes(name)) {
      expect(data.get("updated_at")).toBe(updatedAt)
      expect(data.get("confirmed")).toBe("true")
    }
    if (name === "Course archive") expect(data.get("status")).toBe("archived")
    await act(async () => finish({ ok: true, message: "Action completed." }))
    expect(await screen.findByRole("status")).toHaveTextContent(name === "Course" ? "Course deleted." : "Action completed.")
    expect(screen.queryByRole("button", { name: /Confirm/ })).not.toBeInTheDocument()
    fireEvent.submit(form)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it("shows friendly feedback when the action throws and allows cancellation", async () => {
    vi.mocked(action).mockRejectedValue(new Error("private database details"))
    const user = userEvent.setup()
    render(element())
    await open(user)
    await user.click(screen.getByRole("button", { name: /Confirm/ }))
    expect(await screen.findByRole("status")).toHaveTextContent("We could not complete this action")
    expect(screen.getByRole("status")).not.toHaveTextContent("private database details")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(action).toHaveBeenCalledTimes(1)
  })
})
