"use server"

import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login?error=Session+not+established")
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile) {
    const { error } = await supabase.rpc("ensure_student_profile")
    if (!error) {
      const result = await supabase.from("profiles").select("role,status").eq("auth_user_id", user.id).single()
      profile = result.data
    }
  }
  if (!profile || profile.status !== "active" || !["instructor", "student", "super_admin"].includes(profile.role)) {
    await supabase.auth.signOut()
    redirect("/login?error=Account+setup+is+incomplete+or+access+is+disabled.+Please+contact+the+academy.")
  }
  redirect(profile.role === "instructor" ? "/instructor" : profile.role === "student" ? "/student" : "/admin")
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const supabase = await createSupabaseServerClient({ passwordRecovery: true })
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent("Unable to send a reset link. Please try again.")}`)
  }

  redirect("/forgot-password?sent=1")
}
