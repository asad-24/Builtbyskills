import type { ReactNode } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { getCurrentProfile } from "@/lib/auth/session"
import { MissingEnvironmentError } from "@/lib/errors"

const links = [
  { href: "/instructor", label: "Overview" },
  { href: "/instructor/courses", label: "Assigned Courses" },
  { href: "/instructor/live-classes", label: "Live Classes" },
  { href: "/instructor/announcements", label: "Announcements" },
]

export default async function InstructorLayout({ children }: { children: ReactNode }) {
  let profile = null
  try {
    profile = await getCurrentProfile()
  } catch (error) {
    if (!(error instanceof MissingEnvironmentError)) throw error
  }
  return <DashboardShell profile={profile} role="instructor" links={links}>{children}</DashboardShell>
}
