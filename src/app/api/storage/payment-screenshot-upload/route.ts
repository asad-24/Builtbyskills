import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  fileName: z.string().min(3),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
  size: z.number().int().min(1).max(5 * 1024 * 1024),
})

export async function POST(request: NextRequest) {
  const parsed = requestSchema.parse(await request.json())
  const extension = parsed.fileName.split(".").pop()?.toLowerCase() ?? "upload"
  const path = `public-enrollment/${crypto.randomUUID()}.${extension}`
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.storage
    .from("payment-screenshots")
    .createSignedUploadUrl(path)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    path,
    token: data.token,
  })
}
