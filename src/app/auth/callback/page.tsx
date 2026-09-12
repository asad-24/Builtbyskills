import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AuthCallbackPage() {
  const supabase = await createSupabaseServerClient()
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
