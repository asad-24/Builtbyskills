import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PaymentMethodSelector } from "@/components/public/payment-method-selector"

const methods = [
  {
    id: "bank", method_type: "bank_transfer" as const, display_name: "Bank transfer",
    bank_name: "Configured Bank", account_title: "Bank Holder", account_number: "123456",
    iban_number: "PK36SCBL0000001123456702", instructions: "Include your reference.\nKeep your receipt.",
  },
  {
    id: "jazzcash", method_type: "jazzcash" as const, display_name: "JazzCash",
    account_title: "Wallet Holder", account_number: "03001234567", instructions: "Send to this wallet.",
  },
  {
    id: "easypaisa", method_type: "easypaisa" as const, display_name: "EasyPaisa",
    account_title: "Other Holder", account_number: "03007654321", iban_number: "", bank_name: null,
  },
]

describe("PaymentMethodSelector", () => {
  it("copies exact displayed values with keyboard access and resets feedback without submitting", async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    const submit = vi.fn(event => event.preventDefault())
    render(<form onSubmit={submit}><PaymentMethodSelector methods={[{ ...methods[0], account_number: " 123 456 " }]} /></form>)
    const account = screen.getByRole("button", { name: "Copy account number" })
    const iban = screen.getByRole("button", { name: "Copy IBAN" })
    expect(screen.getAllByRole("button")).toHaveLength(2)
    account.focus()
    await user.keyboard("{Enter}")
    expect(writeText).toHaveBeenLastCalledWith(" 123 456 ")
    expect(account).toHaveAttribute("title", "Copied")
    await user.tab()
    expect(iban).toHaveFocus()
    await waitFor(() => expect(account).toHaveAttribute("title", "Copy account number"), { timeout: 3000 })
    await user.keyboard(" ")
    expect(writeText).toHaveBeenLastCalledWith(methods[0].iban_number)
    expect(iban).toHaveAttribute("title", "Copied")
    expect(submit).not.toHaveBeenCalled()
  })

  it("reports clipboard failure without claiming success", async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"))
    render(<PaymentMethodSelector methods={[methods[0]]} />)
    await user.click(screen.getByRole("button", { name: "Copy IBAN" }))
    expect(within(screen.getByRole("group")).getAllByRole("status")[1]).toHaveTextContent("Unable to copy")
    expect(screen.getByRole("button", { name: "Copy IBAN" })).toHaveAttribute("title", "Copy IBAN")
  })

  it("excludes inactive methods while allowing multiple active methods", () => {
    render(<PaymentMethodSelector methods={methods.map((method, index) => ({ ...method, is_active: index !== 0 }))} />)
    expect(screen.queryByRole("radio", { name: "Bank transfer" })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "JazzCash" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "EasyPaisa" })).toBeInTheDocument()
    expect(screen.queryByText("123456")).not.toBeInTheDocument()
  })
  it("submits only the selected method, supports label clicks and keyboard selection, and resets", async () => {
    const user = userEvent.setup()
    const { container } = render(<form><PaymentMethodSelector methods={methods} /></form>)
    const form = container.querySelector("form")!
    expect(new FormData(form).getAll("payment_method_id")).toEqual(["bank"])

    await user.click(screen.getByText("JazzCash"))
    expect(screen.getByRole("radio", { name: "JazzCash" })).toBeChecked()
    expect(new FormData(form).getAll("payment_method_id")).toEqual(["jazzcash"])

    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("radio", { name: "EasyPaisa" })).toBeChecked()
    expect(new FormData(form).getAll("payment_method_id")).toEqual(["easypaisa"])
    form.reset()
    expect(screen.getByRole("radio", { name: "Bank transfer" })).toBeChecked()
  })

  it("associates each control with its own details and renders bank details in the requested order", () => {
    render(<PaymentMethodSelector methods={methods} />)
    const radio = screen.getByRole("radio", { name: "Bank transfer" })
    const details = document.getElementById(radio.getAttribute("aria-controls")!)!
    expect(Array.from(details.querySelectorAll("dt"), (node) => node.textContent)).toEqual([
      "Bank Name", "Account Holder Name", "Account Number", "IBAN Number", "Instructions",
    ])
    expect(Array.from(details.querySelectorAll("dd"), (node) => node.textContent)).toEqual([
      methods[0].bank_name, methods[0].account_title, methods[0].account_number,
      methods[0].iban_number, methods[0].instructions,
    ])
  })

  it("renders only configured wallet details, including optional details when provided", () => {
    render(<PaymentMethodSelector methods={[
      methods[1], methods[2], { ...methods[1], id: "extra", display_name: "Extra wallet", bank_name: "Wallet Bank", iban_number: "Configured IBAN" },
    ]} />)
    for (const name of ["JazzCash", "EasyPaisa"]) {
      const radio = screen.getByRole("radio", { name })
      const details = document.getElementById(radio.getAttribute("aria-controls")!)!
      const labels = Array.from(details.querySelectorAll("dt"), (node) => node.textContent)
      expect(labels).toContain("Account Title")
      expect(labels).toContain("Account Number")
      expect(labels).not.toContain("Bank Name")
      expect(labels).not.toContain("IBAN Number")
    }
    expect(screen.getByText("Wallet Bank")).toBeInTheDocument()
    expect(screen.getByText("Configured IBAN")).toBeInTheDocument()
    expect(screen.getAllByText("Send to this wallet.")).toHaveLength(2)
  })
})
