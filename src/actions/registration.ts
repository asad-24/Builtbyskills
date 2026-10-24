"use server"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getPublicEnv } from "@/lib/env"

type State = { ok: boolean; message: string }
const registration = z.object({
  full_name: z.string().trim().min(3, "Enter your full name.").max(200),
  email: z.string().trim().email("Enter a valid email address.").transform(value => value.toLowerCase()),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(50),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(128),
  confirm_password: z.string(),
}).refine(value => value.password === value.confirm_password, "Passwords must match.")

export async function registerStudentAction(_: State | undefined, data: FormData): Promise<State> {
  const result = registration.safeParse(Object.fromEntries(data))
  if (!result.success) return { ok: false, message: result.error.issues[0].message }
  let signedIn = false
  try {
    const { full_name, email, phone, password } = result.data
    const supabase = await createSupabaseServerClient()
    const { data: auth, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name, phone, role: "student" }, emailRedirectTo: `${getPublicEnv().siteUrl}/auth/confirm` },
    })
    if (error) return { ok: false, message: "Unable to register. Please try again, or use Sign in / Forgot password if you already have an account." }
    if (auth.session) {
      const { error: profileError } = await supabase.rpc("ensure_student_profile")
      if (profileError) {
        await supabase.auth.signOut()
        return { ok: false, message: "Your account was created. Please sign in to finish setup, or contact the academy if setup remains unavailable." }
      }
      signedIn = true
    }
  } catch { return { ok: false, message: "Registration is temporarily unavailable. Please try again." } }
  if (signedIn) redirect("/student")
  return { ok: true, message: "Check your email to confirm your account, then sign in. If you already registered, use Sign in or Forgot password. Course access starts after enrollment approval." }
}
