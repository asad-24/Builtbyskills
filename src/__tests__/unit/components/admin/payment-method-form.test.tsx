import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/actions/admin", () => ({
  createPaymentMethodAction: vi.fn(), updatePaymentMethodAction: vi.fn(), updatePaymentMethodStatusAction: vi.fn(),
}))
import { createPaymentMethodAction, updatePaymentMethodAction, updatePaymentMethodStatusAction } from "@/actions/admin"
import { PaymentMethodForm, PaymentMethodAvailabilityForm } from "@/components/admin/payment-method-form"

const method = { id: "550e8400-e29b-41d4-a716-446655440001", updated_at: "2026-10-01T12:00:00Z", method_type: "bank_transfer", display_name: "Bank Transfer", account_title: "Academy", account_number: "123456", iban_number: null, bank_name: null, instructions: null, is_active: true }

describe("payment method forms", () => {
  beforeEach(() => vi.clearAllMocks())

  it("preserves entered details and shows an accessible friendly validation error", async () => {
    const user = userEvent.setup()
    vi.mocked(updatePaymentMethodAction).mockResolvedValue({ ok: false, message: "Enter only the IBAN value. Do not include the word IBAN." })
    render(<PaymentMethodForm method={method} />)
    await user.clear(screen.getByLabelText("Account title"))
    await user.type(screen.getByLabelText("Account title"), "Corrected title")
    await user.type(screen.getByLabelText(/IBAN \(optional\)/), "IBAN PK42")
    await user.click(screen.getByRole("button", { name: "Save details" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter only the IBAN value")
    expect(screen.getByLabelText("Account title")).toHaveValue("Corrected title")
    expect(screen.getByLabelText(/IBAN \(optional\)/)).toHaveValue("IBAN PK42")
    const data = vi.mocked(updatePaymentMethodAction).mock.calls[0][1]
    expect(data.get("id")).toBe(method.id)
    expect(data.get("updated_at")).toBe(method.updated_at)
    expect(data.has("is_active")).toBe(false)
  })

  it("disables fields and repeated submits while saving", async () => {
    const user = userEvent.setup()
    let finish!: (value: { ok: boolean; message: string }) => void
    vi.mocked(updatePaymentMethodAction).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<PaymentMethodForm method={method} />)
    await user.click(screen.getByRole("button", { name: "Save details" }))
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled()
    expect(screen.getByLabelText("Account number")).toBeDisabled()
    finish({ ok: true, message: "Payment details saved." })
    expect(await screen.findByRole("status")).toHaveTextContent("Payment details saved.")
    await waitFor(() => expect(screen.getByRole("button", { name: "Save details" })).toBeEnabled())
  })

  it.each([true, false])("offers the correct availability action for active=%s", async is_active => {
    const user = userEvent.setup()
    vi.mocked(updatePaymentMethodStatusAction).mockResolvedValue({ ok: true, message: "Availability saved." })
    render(<PaymentMethodAvailabilityForm method={{ ...method, is_active }} />)
    await user.click(screen.getByRole("button", { name: is_active ? "Deactivate method" : "Activate method" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Availability saved.")
    expect(vi.mocked(updatePaymentMethodStatusAction).mock.calls[0][1].get("is_active")).toBe(String(!is_active))
  })

  it("supports creating an inactive method with optional fields blank", async () => {
    const user = userEvent.setup()
    vi.mocked(createPaymentMethodAction).mockResolvedValue({ ok: true, message: "Payment method created." })
    render(<PaymentMethodForm />)
    await user.type(screen.getByLabelText("Display name"), "JazzCash")
    await user.type(screen.getByLabelText("Account title"), "Academy")
    await user.type(screen.getByLabelText("Account number"), "03001234567")
    await user.selectOptions(screen.getByLabelText("Method type"), "jazzcash")
    await user.click(screen.getByLabelText("Available for enrollment"))
    await user.click(screen.getByRole("button", { name: "Add method" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Payment method created.")
    const data = vi.mocked(createPaymentMethodAction).mock.calls[0][1]
    expect(data.get("method_type")).toBe("jazzcash")
    expect(data.has("is_active")).toBe(false)
    expect(data.get("iban_number")).toBe("")
    expect(screen.getByLabelText("Display name")).toHaveValue("")
    expect(screen.getByLabelText("Available for enrollment")).toBeChecked()
  })
})
