import { describe, expect, it, vi } from "vitest"

import "@/test/mocks/next-link"

vi.mock("@/actions/auth", () => ({ signOutAction: vi.fn() }))

import { render, screen } from "@/test/utils/render"
const navigation = vi.hoisted(() => ({ pathname: "/student" }))
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }))
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PublicPageShell } from "@/components/public/site-shell"

describe("BuiltBySkills branding boundaries", () => {
  it("reuses the official logo and preserves navigation labels, order, and destinations", () => {
    navigation.pathname = "/student/resources"
    const links = [
      { href: "/student", label: "Overview" },
      { href: "/student/courses", label: "My Courses" },
      { href: "/student/live-classes", label: "Live Classes" },
      { href: "/student/resources", label: "Resources" },
      { href: "/student/announcements", label: "Announcements" },
      { href: "/student/payment-history", label: "Payment History" },
      { href: "/student/profile-security", label: "Profile & Security" },
    ]
    const { container } = render(<DashboardShell role="student" links={links} profile={null}><p>Student page</p></DashboardShell>)
    const logo = screen.getByRole("img", { name: "Builtbyskills logo" })
    expect(logo).toHaveAttribute("width", "48")
    expect(logo).toHaveAttribute("height", "48")
    expect(logo.getAttribute("src")).toContain("BBS%20LOGO.png")
    const items = Array.from(screen.getByRole("navigation", { name: "Student navigation" }).querySelectorAll("a"))
    expect(items.map(item => ({ href: item.getAttribute("href"), label: item.textContent }))).toEqual(links)
    expect(items.filter(item => item.getAttribute("aria-current") === "page")).toEqual([items[3]])
    expect(container.querySelectorAll("nav svg[aria-hidden='true']")).toHaveLength(links.length)
  })
  it("updates the current page indicator without treating Overview as active on every route", () => {
    const links = [{ href: "/student", label: "Overview" }, { href: "/student/courses", label: "My Courses" }]
    navigation.pathname = "/student"
    const { rerender } = render(<DashboardShell role="student" links={links} profile={null}>Content</DashboardShell>)
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")
    navigation.pathname = "/student/courses/example"
    rerender(<DashboardShell role="student" links={links} profile={null}>Content</DashboardShell>)
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("link", { name: "My Courses" })).toHaveAttribute("aria-current", "page")
  })
  it("brands the student shell and its shared controls", () => {
    const { container } = render(
      <DashboardShell role="student" links={[]} profile={null}>
        <p>Student page</p>
      </DashboardShell>
    )
    expect(container.firstElementChild).toHaveClass("bbs-theme", "bbs-student")
    expect(container.querySelector("button")?.closest(".bbs-theme")).not.toBeNull()
  })

  it("keeps the instructor shell and its shared controls outside branding", () => {
    const { container } = render(
      <DashboardShell role="instructor" links={[]} profile={null}>
        <p>Instructor page</p>
      </DashboardShell>
    )
    expect(container.firstElementChild).toHaveAttribute("class", "min-h-screen bg-slate-50 text-slate-950")
    expect(container.querySelector(".bbs-theme")).toBeNull()
  })

  it("includes the public header, content, and footer in branding", () => {
    const { container } = render(
      <PublicPageShell><main>Public page</main></PublicPageShell>
    )
    for (const selector of ["header", "main", "footer"]) {
      expect(container.querySelector(selector)?.closest(".bbs-theme")).not.toBeNull()
    }
  })
})
