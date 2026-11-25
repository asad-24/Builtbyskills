import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@/test/utils/render"

const navigation = vi.hoisted(() => ({ pending: false }))
vi.mock("next/link", () => ({
  useLinkStatus: () => navigation,
  default: ({ href, children, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}))

import { NavigationLink } from "@/components/public/navigation-link"
import EnrollmentLoading from "@/app/enroll/loading"

describe("public navigation feedback", () => {
  it("shows loading only for a pending navigation and restores the label afterward", () => {
    navigation.pending = false
    const { rerender } = render(<NavigationLink href="/enroll">Join Now</NavigationLink>)
    const link = screen.getByRole("link", { name: "Join Now" })
    expect(link).toHaveAttribute("href", "/enroll")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    navigation.pending = true
    rerender(<NavigationLink href="/enroll">Join Now</NavigationLink>)
    expect(screen.getByRole("status")).toHaveTextContent("Loading...")
    expect(screen.getByRole("link", { name: "Loading..." })).toBe(link)
    expect(link.querySelector('[aria-busy="true"]')).toBeInTheDocument()

    navigation.pending = false
    rerender(<NavigationLink href="/enroll">Join Now</NavigationLink>)
    expect(screen.getByRole("link", { name: "Join Now" })).toBe(link)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("renders an enrollment loading screen before the form data arrives", () => {
    render(<EnrollmentLoading />)
    expect(screen.getByRole("heading", { name: "Enroll in Builtbyskills" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Loading enrollment form...")
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true")
  })
})
