import "server-only"

import { redirect } from "next/navigation"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Profile, UserRole } from "@/types/lms"

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single()

  if (error || !data) return null
  return data as Profile
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
    const profile = await requireRole([role])
    return profile
  } catch (error) {
    if (error instanceof MissingEnvironmentError) return null
    redirect(fallback)
  }
}
