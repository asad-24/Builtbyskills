import { NextRequest, NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/session"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: { fileName?: string; contentType?: string; size?: number }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : ""
  const contentType = typeof payload.contentType === "string" ? payload.contentType.trim() : ""
  const size = typeof payload.size === "number" ? payload.size : NaN

  if (!fileName || !contentType || Number.isNaN(size)) {
    return NextResponse.json({ error: "fileName, contentType, and size are required." }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(contentType as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: "Unsupported file type. Use PNG, JPG, or WEBP." }, { status: 400 })
  }

  if (size <= 0 || size > MAX_SIZE) {
    return NextResponse.json({ error: "File size must be between 1 byte and 5MB." }, { status: 400 })
  }

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "bin"
  const path = `course-thumbnails/${crypto.randomUUID()}.${extension}`

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.storage
      .from("course-thumbnails")
      .createSignedUploadUrl(path)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ path, token: data.token })
  } catch (error) {
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
