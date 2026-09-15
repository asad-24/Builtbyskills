"use server"

import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (profile?.role === "instructor") {
    redirect("/instructor")
  } else if (profile?.role === "student") {
    redirect("/student")
  } else {
    redirect("/admin")
  }
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
  const supabase = await createSupabaseServerClient()
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent("Unable to send a reset link. Please try again.")}`)
  }

  redirect("/forgot-password?sent=1")
}
