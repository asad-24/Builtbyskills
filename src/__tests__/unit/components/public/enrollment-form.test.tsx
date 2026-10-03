import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render, screen, waitFor } from "@/test/utils/render"

vi.mock("@/actions/public", () => ({ submitEnrollmentAction: vi.fn() }))
const upload = vi.fn()
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: upload }) } }),
}))

import { submitEnrollmentAction } from "@/actions/public"
import { EnrollmentForm } from "@/components/public/enrollment-form"

const courseId = "550e8400-e29b-41d4-a716-446655440000"
const methodId = "550e8400-e29b-41d4-a716-446655440001"
const path = "public-enrollment/receipt.png"
function setup() {
  return render(<EnrollmentForm
    courses={[{ id: courseId, title: "Course", price: 5000, currency: "PKR" }]}
    methods={[{ id: methodId, display_name: "Bank", method_type: "bank_transfer", account_title: "Academy", account_number: "123" }]}
  />)
}
async function fillDetails() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Full name"), " A ")
  await user.type(screen.getByLabelText("Email"), "a@example.com")
  await user.type(screen.getByLabelText("Phone number"), "+92 300 1234567")
  await user.type(screen.getByLabelText("WhatsApp number (Optional)"), "0300-1234567")
  await user.selectOptions(screen.getByLabelText("Selected course"), courseId)
  await user.click(screen.getByRole("radio", { name: "Bank" }))
  return user
}
async function uploadReceipt() {
  await userEvent.upload(screen.getByLabelText("Payment screenshot"), new File(["receipt"], "receipt.png", { type: "image/png" }))
}

describe("EnrollmentForm validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(submitEnrollmentAction).mockResolvedValue({ ok: true, message: "Enrollment submitted." })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ path, token: "signed-token" }) }))
    upload.mockResolvedValue({ error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("blocks empty submission, shows friendly field errors, and focuses name", async () => {
    setup()
    await userEvent.click(screen.getByRole("button", { name: "Submit enrollment" }))
    expect(submitEnrollmentAction).not.toHaveBeenCalled()
    for (const message of ["Please enter your name.", "Please enter a valid email.", "Please enter your phone number.",
      "Please select a course.", "Please select a payment method.", "Please upload your payment screenshot."]) {
      expect(screen.getByText(message)).toBeInTheDocument()
    }
    expect(screen.getByLabelText("Full name")).toHaveFocus()
    expect(screen.getByLabelText("Full name")).toHaveAttribute("aria-invalid", "true")
  })

  it.each([
    ["Full name", "   ", "Please enter your name."],
    ["Email", "invalid", "Please enter a valid email."],
    ["Phone number", "1", "Please enter a valid phone number."],
    ["WhatsApp number (Optional)", "1", "Please enter a valid WhatsApp number."],
    ["Selected course", "", "Please select a course."],
  ])("blocks invalid %s and focuses the field", async (label, value, message) => {
    const { container } = setup()
    await fillDetails()
    await uploadReceipt()
    await waitFor(() => expect(screen.getByText("Payment screenshot uploaded.")).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.submit(container.querySelector("form")!)
    expect(submitEnrollmentAction).not.toHaveBeenCalled()
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText(label)).toHaveFocus()
  })

  it.each(["", "   ", "0300-1234567"])("submits with WhatsApp %j while keeping other required inputs", async whatsapp => {
    setup()
    const user = await fillDetails()
    const input = screen.getByLabelText("WhatsApp number (Optional)")
    expect(input).not.toBeRequired()
    for (const label of ["Full name", "Email", "Phone number", "Selected course"]) expect(screen.getByLabelText(label)).toBeRequired()
    fireEvent.change(input, { target: { value: whatsapp } })
    await uploadReceipt()
    await waitFor(() => expect(screen.getByText("Payment screenshot uploaded.")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    await waitFor(() => expect(submitEnrollmentAction).toHaveBeenCalledOnce())
    expect(vi.mocked(submitEnrollmentAction).mock.calls[0][1].get("whatsapp")).toBe(whatsapp)
  })

  it("requires screenshot completion and accepts a one-character name with optional details empty", async () => {
    setup()
    const user = await fillDetails()
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    expect(submitEnrollmentAction).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Payment screenshot")).toHaveFocus()
    let complete!: (value: { error: null }) => void
    upload.mockReturnValue(new Promise(resolve => { complete = resolve }))
    await uploadReceipt()
    await waitFor(() => expect(upload).toHaveBeenCalledOnce())
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    expect(submitEnrollmentAction).not.toHaveBeenCalled()
    expect(document.getElementById("screenshot_path-error")).toHaveTextContent(/upload/i)
    await act(async () => complete({ error: null }))
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    await waitFor(() => expect(submitEnrollmentAction).toHaveBeenCalledOnce())
    const data = vi.mocked(submitEnrollmentAction).mock.calls[0][1]
    expect(data.get("screenshot_path")).toBe(path)
    expect(data.get("screenshot_upload_status")).toBe("uploaded")
    expect(data.get("city")).toBe("")
    expect(data.get("message")).toBe("")
    await waitFor(() => expect(screen.getByText("Enrollment submitted.")).toBeInTheDocument())
    expect(screen.queryByText("Please upload your payment screenshot.")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Full name")).toHaveValue("")
    expect(screen.getByLabelText("Selected course")).toHaveValue("")
    expect(screen.getByRole("radio", { name: "Bank" })).not.toBeChecked()
    expect(document.querySelector('[name="screenshot_path"]')).toHaveValue("")
  })

  it("blocks failed uploads without exposing provider errors", async () => {
    setup()
    const user = await fillDetails()
    upload.mockResolvedValue({ error: { message: '{"private":"storage details"}' } })
    await uploadReceipt()
    await waitFor(() => expect(screen.getByText("Could not upload screenshot. Please choose the file again to retry.")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    expect(submitEnrollmentAction).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Payment screenshot")).toHaveFocus()
    expect(screen.queryByText(/private|storage details/)).not.toBeInTheDocument()
  })

  it("shows authoritative server field errors, focuses the field, and clears errors after retry", async () => {
    setup()
    const user = await fillDetails()
    await uploadReceipt()
    await waitFor(() => expect(screen.getByText("Payment screenshot uploaded.")).toBeInTheDocument())
    vi.mocked(submitEnrollmentAction).mockResolvedValueOnce({
      ok: false, message: "Please upload your payment screenshot.",
      fieldErrors: { screenshot_path: "The screenshot is unavailable. Please upload it again." },
    })
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    await waitFor(() => expect(screen.getByText("The screenshot is unavailable. Please upload it again.")).toBeInTheDocument())
    expect(screen.getByLabelText("Payment screenshot")).toHaveFocus()
    expect(screen.getByLabelText("Full name")).toHaveValue(" A ")
    expect(screen.getByLabelText("Email")).toHaveValue("a@example.com")
    expect(screen.getByLabelText("Selected course")).toHaveValue(courseId)
    expect(screen.getByRole("radio", { name: "Bank" })).toBeChecked()
    await uploadReceipt()
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    await waitFor(() => expect(screen.getByText("Enrollment submitted.")).toBeInTheDocument())
    expect(screen.queryByText("The screenshot is unavailable. Please upload it again.")).not.toBeInTheDocument()
  })
})
