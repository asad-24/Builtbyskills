import "server-only"
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { mongoDb } from "./connection"
import { ensureIndexes } from "./schema"
import { databaseError } from "./query"

const buckets = new Set(["course-thumbnails", "payment-screenshots", "lesson-resources"])
export const uploadChunkSize = 1024 * 1024
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
function checkPath(bucket: string, path: string) {
  if (!buckets.has(bucket) || !path || path.length > 500 || path.split("/").some(part => !part || part === "." || part === "..") || !/^[a-zA-Z0-9_./-]+$/.test(path)) throw new Error("Invalid file path")
}
const baseUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
function secret() { const value = process.env.BETTER_AUTH_SECRET; if (!value || value.length < 32) throw new Error("File signing is not configured"); return value }
function signature(bucket: string, path: string, expiry: string) { return createHmac("sha256", secret()).update(JSON.stringify([bucket, path, expiry])).digest("hex") }
export function verifyFileSignature(bucket: string, path: string, expiry: string, token: string) {
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now() || !/^[a-f0-9]{64}$/.test(token)) return false
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(signature(bucket, path, expiry), "hex"))
}
export function fileUrl(bucket: string, path: string, expires?: number) {
  checkPath(bucket, path)
  const url = new URL("/api/files/object", baseUrl())
  url.searchParams.set("bucket", bucket); url.searchParams.set("path", path)
  if (expires) { const expiry = String(Date.now() + expires * 1000); url.searchParams.set("expires", expiry); url.searchParams.set("signature", signature(bucket, path, expiry)) }
  return url.toString()
}
export class FileStore {
  from(bucket: string) {
    return {
      createSignedUploadUrl: async (path: string, _options?: { upsert?: boolean }) => {
        void _options
        try {
          checkPath(bucket, path); await ensureIndexes()
          const token = randomBytes(32).toString("base64url"), id = randomUUID()
          await mongoDb().collection("file_grants").insertOne({ token: digest(token), id, bucket, path, expiresAt: new Date(Date.now() + 600_000), used: false, maxSize: bucket === "lesson-resources" ? 25 * 1024 * 1024 : 5 * 1024 * 1024 })
          return { data: { path, token }, error: null }
        } catch (error) { return { data: null, error: databaseError(error) } }
      },
      info: async (path: string) => {
        try { checkPath(bucket, path); const file = await mongoDb().collection("files").findOne({ bucket, path, ready: true }); return { data: file ? { size: file.size as number, contentType: file.contentType as string } : null, error: null } }
        catch (error) { return { data: null, error: databaseError(error) } }
      },
      createSignedUrl: async (path: string, expires: number, _options?: { download?: string }) => {
        void _options
        try { const file = await mongoDb().collection("files").findOne({ bucket, path, ready: true }); if (!file) throw new Error("Missing file"); return { data: { signedUrl: fileUrl(bucket, path, Math.min(300, expires)) }, error: null } }
        catch (error) { return { data: null, error: databaseError(error) } }
      },
      getPublicUrl: (path: string) => {
        const url = new URL(fileUrl(bucket, path))
        return { data: { publicUrl: bucket === "course-thumbnails" ? `${url.pathname}${url.search}` : "" } }
      },
      upload: async (path: string, body: Buffer, options?: { contentType?: string; upsert?: boolean }) => {
        try {
          checkPath(bucket, path); await ensureIndexes()
          if (body.length > (bucket === "lesson-resources" ? 25 : 5) * 1024 * 1024 || !body.length) throw new Error("Invalid file size")
          const id = randomUUID()
          for (let i = 0; i * uploadChunkSize < body.length; i++) await mongoDb().collection("file_chunks").insertOne({ fileId: id, index: i, bytes: body.subarray(i * uploadChunkSize, (i + 1) * uploadChunkSize) })
          await mongoDb().collection("files").updateOne({ bucket, path }, { $set: { id, bucket, path, contentType: options?.contentType || "application/octet-stream", size: body.length, chunks: Math.ceil(body.length / uploadChunkSize), ready: true } }, { upsert: options?.upsert ?? true })
          return { data: { path }, error: null }
        } catch (error) { return { data: null, error: databaseError(error) } }
      },
    }
  }
}
export async function uploadGrant(token: string, bucket: string, path: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null
  checkPath(bucket, path)
  return mongoDb().collection("file_grants").findOne({ token: digest(token), bucket, path, used: false, expiresAt: { $gt: new Date() } })
}
