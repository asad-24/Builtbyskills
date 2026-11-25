import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"
import { cookies } from "next/headers"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { createDatabaseServerClient } from "@/lib/database/server"
import { mongoDb } from "@/lib/database/connection"
import { reportDatabaseError } from "@/lib/database/diagnostics"
import type { Profile, UserRole } from "@/types/lms"

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createDatabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user || !user.emailVerified) return null
  // The user ID comes from Better Auth's verified database session. Avoid a
  // second policy/profile lookup through the general-purpose query adapter.
  try {
    const profile = await mongoDb().collection("profiles").findOne({ auth_user_id: user.id }, { projection: { _id: 0 } })
    return profile as Profile | null
  } catch (error) {
    reportDatabaseError(error, { operation: "select", collection: "profiles" })
    return null
  }
}

const readProfile = cache(async (cookieKey: string) => {
  void cookieKey
  return getCurrentProfile()
})

// React caches only the current render. Cookie changes force a fresh lookup;
// mutation/API guards below deliberately use the uncached profile reader.
export async function requireAdminRead() {
  const profile = await readProfile((await cookies()).toString())
  if (!profile) throw new AppAuthError()
  if (profile.status !== "active" || profile.role !== "super_admin") throw new AppForbiddenError()
  return profile
}

export async function requireProfile() {
  const profile = await getCurrentProfile()
  if (!profile) throw new AppAuthError()
  if (profile.status !== "active") {
    throw new AppForbiddenError("This account is not active.")
  }
  return profile
}

export async function requireRole(roles: UserRole[]) {
  const profile = await requireProfile()
  if (!roles.includes(profile.role)) {
    throw new AppForbiddenError()
  }
  return profile
}

export async function requireAdmin() {
  return requireRole(["super_admin"])
}

export async function guardDashboard(role: UserRole, fallback = "/login") {
  try {
    const profile = role === "super_admin" ? await requireAdminRead() : await requireRole([role])
    return profile
  } catch (error) {
    if (error instanceof MissingEnvironmentError) return null
    redirect(fallback)
  }
}
