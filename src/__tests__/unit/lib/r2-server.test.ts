import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { GetObjectCommand, UploadPartCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getR2Client, getR2Config } from "@/lib/r2/server"
beforeEach(() => {
  // Synthetic test values only. Never reads or prints the real .env.local.
  vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic-test-access")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic-test-secret")
  vi.stubEnv("R2_ENDPOINT", "https://synthetic.r2.cloudflarestorage.com")
  vi.stubEnv("R2_BUCKET_NAME", "builtbyskills-course-videos")
})
afterEach(() => vi.unstubAllEnvs())
describe("server-only R2 configuration", () => {
  it("requires credentials without including their values in errors", () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "")
    expect(() => getR2Config()).toThrow("R2_SECRET_ACCESS_KEY")
  })
  it.each(["http://synthetic.r2.cloudflarestorage.com", "https://example.com", "https://user:pass@synthetic.r2.cloudflarestorage.com"])("rejects an unsuitable endpoint", endpoint => {
    vi.stubEnv("R2_ENDPOINT", endpoint)
    expect(() => getR2Config()).toThrow()
  })
  it("rejects a different bucket", () => {
    vi.stubEnv("R2_BUCKET_NAME", "public-assets")
    expect(() => getR2Config()).toThrow()
  })
  it("signs GET with the non-secret ID and never includes the secret", async () => {
    const client = getR2Client()
    try {
      const raw = await getSignedUrl(client, new GetObjectCommand({ Bucket: getR2Config().bucket, Key: "synthetic/video.mp4", ResponseCacheControl: "private, no-store" }), { expiresIn: 300 })
      const url = new URL(raw)
      expect(url.searchParams.get("X-Amz-Credential")).toContain("synthetic-test-access/")
      expect(url.searchParams.get("X-Amz-Expires")).toBe("300")
      expect(decodeURIComponent(raw)).not.toContain("synthetic-test-secret")
      expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host")
    } finally { client.destroy() }
  })
  it("binds multipart size without requesting an optional empty-body checksum from the browser", async () => {
    const client = getR2Client()
    const url = new URL(await getSignedUrl(client, new UploadPartCommand({ Bucket: getR2Config().bucket, Key: "synthetic/video.mp4", UploadId: "synthetic-upload", PartNumber: 1, ContentLength: 100 }), { expiresIn: 600 }))
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length")
    expect([...url.searchParams.keys()].some(key => /^x-amz-checksum-/i.test(key))).toBe(false)
    client.destroy()
  })
})
