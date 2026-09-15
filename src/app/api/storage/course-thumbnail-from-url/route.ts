import { NextRequest, NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth/session"

const MAX_SIZE = 5 * 1024 * 1024

function getExtensionFromContentType(contentType: string) {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  }
  return map[contentType.split(";")[0].trim().toLowerCase()] ?? "bin"
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: { url?: string }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const rawUrl = typeof payload.url === "string" ? payload.url.trim() : ""
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required." }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 })
  }

  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only HTTPS image URLs are allowed." }, { status: 400 })
  }

  let response: Response
  try {
    response = await fetch(rawUrl)
  } catch {
    return NextResponse.json({ error: "Could not reach the image URL." }, { status: 400 })
  }

  if (!response.ok) {
    return NextResponse.json({ error: `Image URL returned status ${response.status}.` }, { status: 400 })
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "The URL does not point to an image." }, { status: 400 })
  }

  const allowed = ["image/png", "image/jpeg", "image/webp"]
  if (!allowed.includes(contentType.split(";")[0].trim().toLowerCase())) {
    return NextResponse.json({ error: "Unsupported image type. Use PNG, JPG, or WEBP." }, { status: 400 })
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_SIZE) {
    return NextResponse.json({ error: "Image is too large. Max size is 5MB." }, { status: 400 })
  }

  const extension = getExtensionFromContentType(contentType)
  const path = `course-thumbnails/${crypto.randomUUID()}.${extension}`

  try {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.storage
      .from("course-thumbnails")
      .upload(path, buffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path)

    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    return NextResponse.json({ error: "Could not store the image." }, { status: 500 })
  }
}
