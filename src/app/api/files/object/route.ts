import { NextResponse } from "next/server"
import { mongoDb } from "@/lib/database/connection"
import { verifyFileSignature } from "@/lib/database/storage"

export const runtime = "nodejs"
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const bucket = query.get("bucket") || "", path = query.get("path") || ""
  if (bucket !== "course-thumbnails" && !verifyFileSignature(bucket, path, query.get("expires") || "", query.get("signature") || "")) return new NextResponse("Forbidden", { status: 403 })
  const db = mongoDb(), file = await db.collection("files").findOne({ bucket, path, ready: true })
  if (!file) return new NextResponse("File unavailable", { status: 404 })
  const cursor = db.collection("file_chunks").find({ fileId: file.id }).sort({ index: 1 })
  const stream = new ReadableStream({
    async pull(controller) { try { const chunk = await cursor.next(); if (!chunk) { controller.close(); await cursor.close() } else controller.enqueue(new Uint8Array(chunk.bytes.buffer)) } catch (error) { controller.error(error); await cursor.close() } },
    async cancel() { await cursor.close() },
  })
  return new NextResponse(stream, { headers: { "Content-Type": file.contentType, "Content-Length": String(file.size), "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cache-Control": bucket === "course-thumbnails" ? "public, max-age=3600" : "private, no-store", ...(bucket !== "course-thumbnails" ? { "Content-Disposition": "attachment" } : {}) } })
}
