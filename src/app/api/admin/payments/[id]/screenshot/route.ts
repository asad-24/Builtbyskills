import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth/session"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const headers = { "Cache-Control": "private, no-store" }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const supabase = createSupabaseAdminClient()
    const { data: payment, error } = await supabase
      .from("payment_submissions")
      .select("screenshot_path")
      .eq("id", id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: "Could not load payment screenshot." }, { status: 500, headers })
    if (!payment?.screenshot_path) {
      return NextResponse.json({ error: "No screenshot was submitted." }, { status: 404, headers })
    }

    const { data, error: signingError } = await supabase.storage
      .from("payment-screenshots")
      .createSignedUrl(payment.screenshot_path, 60)

    if (signingError || !data?.signedUrl) {
      return NextResponse.json({ error: "Screenshot is currently unavailable. Please retry." }, { status: 502, headers })
    }

    return NextResponse.redirect(data.signedUrl, { status: 307, headers })
  } catch (error) {
    const status = error instanceof AppAuthError ? 401 : error instanceof AppForbiddenError ? 403 : 500
    return NextResponse.json({ error: status === 500 ? "Could not open payment screenshot." : "Unauthorized" }, { status, headers })
  }
}
