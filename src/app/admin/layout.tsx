import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdmin } from "@/lib/auth/session"
import { MissingEnvironmentError } from "@/lib/errors"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let profile = null

  try {
    profile = await requireAdmin()
  } catch (error) {
    if (error instanceof MissingEnvironmentError) {
      return <AdminShell profile={null}>{children}</AdminShell>
    }
    redirect("/login")
  }

  return <AdminShell profile={profile}>{children}</AdminShell>
}
