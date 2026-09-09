import type { ReactNode } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { getCurrentProfile } from "@/lib/auth/session"
import { MissingEnvironmentError } from "@/lib/errors"

const links = [
  { href: "/student", label: "Overview" },
  { href: "/student/courses", label: "My Courses" },
  { href: "/student/live-classes", label: "Live Classes" },
  { href: "/student/resources", label: "Resources" },
  { href: "/student/announcements", label: "Announcements" },
  { href: "/student/payment-history", label: "Payment History" },
  { href: "/student/profile-security", label: "Profile & Security" },
]

export default async function StudentLayout({ children }: { children: ReactNode }) {
  let profile = null
  try {
    profile = await getCurrentProfile()
  } catch (error) {
    if (!(error instanceof MissingEnvironmentError)) throw error
  }
  return <DashboardShell profile={profile} role="student" links={links}>{children}</DashboardShell>
}
