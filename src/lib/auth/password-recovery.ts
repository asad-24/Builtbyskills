import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

export const recoveryError = "This password link is invalid or has expired. Please request a new reset link."
export const passwordUpdateError = "Unable to update your password. Try again or request a new reset link."

export const passwordResetSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters for your password."),
  confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"],
})

export async function establishRecoverySession(supabase: SupabaseClient, url: URL, requireLink: boolean) {
  const query = url.searchParams
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (query.has("error") || query.has("error_code") || fragment.has("error") || fragment.has("error_code")) {
    throw new Error(recoveryError)
  }
  const code = query.get("code")
  const tokenHash = query.get("token_hash")
  const accessToken = fragment.get("access_token")
  const refreshToken = fragment.get("refresh_token")
  const type = query.get("type") ?? fragment.get("type")
  if (type && type !== "recovery" && type !== "invite") throw new Error(recoveryError)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw new Error(recoveryError)
  } else if (tokenHash && (type === "recovery" || type === "invite")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) throw new Error(recoveryError)
  } else if (accessToken && refreshToken && (type === "recovery" || type === "invite")) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) throw new Error(recoveryError)
  } else if (requireLink || url.search || url.hash) {
    // Never fall back to an unrelated existing session after a malformed link.
    throw new Error(recoveryError)
  }
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error(recoveryError)
  return user.id
}

export async function passwordDestination(supabase: SupabaseClient, userId: string) {
  try {
    const { data: profile, error } = await supabase.from("profiles")
      .select("role, status").eq("auth_user_id", userId).single()
    if (error || profile?.status !== "active") return "/login"
    if (profile.role === "super_admin") return "/admin"
    if (profile.role === "instructor") return "/instructor"
    if (profile.role === "student") return "/student"
  } catch {
    // Profile lookup failure must not turn a successful password change into a retry.
  }
  return "/login"
}
