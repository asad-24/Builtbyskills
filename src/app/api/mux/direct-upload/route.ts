import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth/session"
import { createMuxDirectUploadUrl } from "@/lib/mux/server"

export async function POST() {
  await requireAdmin()
  const upload = await createMuxDirectUploadUrl()
  return NextResponse.json(upload.data)
}
