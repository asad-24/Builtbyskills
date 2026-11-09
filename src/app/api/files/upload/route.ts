import { NextResponse } from "next/server"
import { z } from "zod"
import { mongoDb, transaction } from "@/lib/database/connection"
import { uploadGrant, uploadChunkSize } from "@/lib/database/storage"
import { ensureIndexes } from "@/lib/database/schema"

export const runtime = "nodejs"
const error = () => NextResponse.json({ error: "Upload is unavailable or invalid. Upload the file again." }, { status: 400 })
const identity = z.object({ token: z.string(), bucket: z.string(), path: z.string() })
export async function PUT(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const input = identity.parse(Object.fromEntries(params))
    const index = Number(params.get("index"))
    await ensureIndexes()
    const grant = await uploadGrant(input.token, input.bucket, input.path)
    if (!grant || !Number.isInteger(index) || index < 0 || index >= Math.ceil(grant.maxSize / uploadChunkSize)) return error()
    if (Number(request.headers.get("content-length")) > uploadChunkSize) return error()
    const bytes = Buffer.from(await request.arrayBuffer())
    if (!bytes.length || bytes.length > uploadChunkSize) return error()
    await mongoDb().collection("file_chunks").updateOne({ fileId: grant.id, index }, { $setOnInsert: { bytes, expiresAt: new Date(Date.now() + 86400_000) } }, { upsert: true })
    return NextResponse.json({ ok: true })
  } catch { return error() }
}
const finalize = identity.extend({ chunks: z.number().int().min(1).max(25), size: z.number().int().positive(), contentType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf", "application/zip", "application/x-zip-compressed", "text/plain"]) })
export async function POST(request: Request) {
  try {
    const input = finalize.parse(await request.json())
    const grant = await uploadGrant(input.token, input.bucket, input.path)
    if (!grant || input.size > grant.maxSize || input.chunks !== Math.ceil(input.size / uploadChunkSize) || (input.bucket === "course-thumbnails" && !input.contentType.startsWith("image/")) || (input.bucket === "payment-screenshots" && !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(input.contentType))) return error()
    await transaction(async (db, session) => {
      const claim = await db.collection("file_grants").updateOne({ id: grant.id, used: false, expiresAt: { $gt: new Date() } }, { $set: { used: true } }, { session })
      if (!claim.modifiedCount) throw new Error("Grant expired")
      const chunks = await db.collection("file_chunks").find({ fileId: grant.id }, { session }).sort({ index: 1 }).toArray()
      if (chunks.length !== input.chunks || chunks.some((chunk, index) => chunk.index !== index || chunk.bytes.length() !== Math.min(uploadChunkSize, input.size - index * uploadChunkSize))) throw new Error("Incomplete upload")
      const first = Buffer.from(chunks[0].bytes.buffer)
      const type = input.contentType
      const valid = type === "image/png" ? first.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : type === "image/jpeg" ? first[0] === 255 && first[1] === 216 && first[2] === 255
        : type === "image/webp" ? first.subarray(0,4).toString() === "RIFF" && first.subarray(8,12).toString() === "WEBP"
        : type === "application/pdf" ? first.subarray(0,5).toString() === "%PDF-"
        : type.startsWith("application/") ? first.subarray(0,2).toString() === "PK"
        : !first.includes(0)
      if (!valid) throw new Error("Unsupported file")
      await db.collection("files").insertOne({ id: grant.id, bucket: grant.bucket, path: grant.path, size: input.size, contentType: input.contentType, chunks: input.chunks, ready: true }, { session })
      await db.collection("file_chunks").updateMany({ fileId: grant.id }, { $unset: { expiresAt: "" } }, { session })
    })
    return NextResponse.json({ ok: true })
  } catch { return error() }
}
