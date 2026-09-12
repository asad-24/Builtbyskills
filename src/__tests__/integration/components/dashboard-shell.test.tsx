import { describe, it, expect, vi, beforeEach } from "vitest"

import "@/test/mocks/next-link"

vi.mock("@/actions/auth", () => ({
  signOutAction: vi.fn(),
}))

import { render, screen } from "@/test/utils/render"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

describe("DashboardShell", () => {
  it("renders student navigation", async () => {
    render(
      <DashboardShell role="student" links={[{ href: "/student/courses", label: "My Courses" }]} profile={{ id: "student-1", full_name: "Alice", email: "alice@example.com", status: "active" } as any}>
        <div>Student content</div>
      </DashboardShell>
    )
    expect(await screen.findByText("Student content")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "My Courses" })).toBeInTheDocument()
  })

  it("renders instructor navigation", async () => {
    render(
      <DashboardShell role="instructor" links={[{ href: "/instructor/courses", label: "My Courses" }]} profile={{ id: "instructor-1", full_name: "Bob", email: "bob@example.com", status: "active" } as any}>
        <div>Instructor content</div>
      </DashboardShell>
    )
    expect(await screen.findByText("Instructor content")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "My Courses" })).toBeInTheDocument()
  })

  it("renders sign out button", async () => {
    render(
      <DashboardShell role="student" links={[]} profile={{ id: "student-1", full_name: "Alice", email: "alice@example.com", status: "active" } as any}>
        <div>Student content</div>
      </DashboardShell>
    )
    expect(await screen.findByRole("button", { name: /sign out/i })).toBeInTheDocument()
  })
})
