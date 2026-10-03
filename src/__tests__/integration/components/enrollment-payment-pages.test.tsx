import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@/test/utils/render"

vi.mock("@/actions/admin", () => ({ reviewPaymentAction: vi.fn() }))
vi.mock("@/actions/public", () => ({ submitEnrollmentAction: vi.fn() }))
vi.mock("@/components/admin/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) => <form>{children}</form>,
}))
vi.mock("@/components/public/site-shell", () => ({
  PublicPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/features/admin/data", () => ({
  getAdminWorkspaceData: vi.fn(), getEnrollmentPageData: vi.fn(),
}))

import AdminPaymentsPage from "@/app/admin/payments/page"
import EnrollPage from "@/app/enroll/page"
import { getAdminWorkspaceData, getEnrollmentPageData } from "@/features/admin/data"

describe("Enrollment payment pages", () => {
  it("removes the student reference field while preserving course and payment controls", async () => {
    vi.mocked(getEnrollmentPageData).mockResolvedValue({ ok: true, data: {
      courses: [{ id: "course-1", title: "Shopify", price: 5000, currency: "PKR" }],
      paymentMethods: [{ id: "method-1", display_name: "Bank transfer", method_type: "bank_transfer", account_title: "Academy", account_number: "1234", iban_number: "PK00", bank_name: "Bank", instructions: null, is_active: true }],
    } } as never)
    const { container } = render(await EnrollPage())
    expect(container.querySelector('[name="transaction_reference"]')).toBeNull()
    expect(screen.queryByText(/transaction reference|payment reference/i)).toBeNull()
    expect(container.querySelector('[name="course_id"]')).not.toBeNull()
    expect(container.querySelector('[name="payment_method_id"]')).not.toBeNull()
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
    expect(container.querySelector('[name="preferred_batch"]')).toBeNull()
    expect(container.querySelector('[name="experience_level"]')).toBeNull()
  })

  it("keeps historical references and shows secure screenshot links only for provided paths", async () => {
    const payment = { amount: 5000, currency: "PKR", status: "pending", submitted_at: "2026-10-01T12:00:00Z" }
    vi.mocked(getAdminWorkspaceData).mockResolvedValue({ ok: true, data: { payments: [
      { ...payment, id: "payment-with-receipt", transaction_reference: "HISTORICAL-TXN", screenshot_path: "legacy/receipt.jpg" },
      { ...payment, id: "payment-without-receipt", transaction_reference: null, screenshot_path: null },
    ] } } as never)
    render(await AdminPaymentsPage())
    expect(screen.getByText("HISTORICAL-TXN")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Open screenshot" })
    expect(link).toHaveAttribute("href", "/api/admin/payments/payment-with-receipt/screenshot")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    expect(link.closest("tr")).not.toHaveTextContent("Not provided")
    expect(screen.getAllByText("Not provided")).toHaveLength(2)
  })
})
