import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
export async function GET(request: Request) {
  const url = new URL(request.url)
  const supabase = await createSupabaseServerClient()
  const code = url.searchParams.get("code")
  const token_hash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  const failure = () => NextResponse.redirect(new URL("/login?error=Unable+to+confirm+email.+Please+sign+in+or+request+a+new+confirmation.", url.origin))
  try {
    const result = code ? await supabase.auth.exchangeCodeForSession(code)
      : token_hash && ["signup", "email"].includes(type ?? "") ? await supabase.auth.verifyOtp({ token_hash, type: "email" }) : null
    if (!result || result.error) return failure()
    const { error } = await supabase.rpc("ensure_student_profile")
    if (error) { await supabase.auth.signOut(); return failure() }
    return NextResponse.redirect(new URL("/student", url.origin))
  } catch { return failure() }
}
