import type { ReactNode } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { getCurrentProfile } from "@/lib/auth/session"
import { MissingEnvironmentError } from "@/lib/errors"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let profile = null

  try {
    profile = await getCurrentProfile()
  } catch (error) {
    if (!(error instanceof MissingEnvironmentError)) throw error
  }

  return <AdminShell profile={profile}>{children}</AdminShell>
}
