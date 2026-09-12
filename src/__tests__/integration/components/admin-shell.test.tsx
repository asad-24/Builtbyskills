import { describe, it, expect, vi, beforeEach } from "vitest"

import "@/test/mocks/next-link"

vi.mock("@/actions/auth", () => ({
  signOutAction: vi.fn(),
}))

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: vi.fn(),
}))

import { requireAdmin } from "@/lib/auth/session"
import { render, screen } from "@/test/utils/render"
import { AdminShell } from "@/components/admin/admin-shell"

describe("AdminShell", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockResolvedValue({
      id: "admin-1",
      role: "super_admin",
      status: "active",
    } as any)
  })

  it("renders admin navigation links", async () => {
    render(
      <AdminShell profile={{ id: "admin-1", role: "super_admin", status: "active" } as any}>
        <div>Admin content</div>
      </AdminShell>
    )
    expect(await screen.findByText("Admin content")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument()
  })

  it("renders sign out button", async () => {
    render(
      <AdminShell profile={{ id: "admin-1", role: "super_admin", status: "active" } as any}>
        <div>Admin content</div>
      </AdminShell>
    )
    expect(await screen.findByRole("button", { name: /sign out/i })).toBeInTheDocument()
  })
})
