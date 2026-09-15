import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn(() => ({
  data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/course-thumbnails/test.jpg" },
}))

const mockSupabase = {
  storage: {
    from: vi.fn(() => ({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    })),
  },
}

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabase),
}))

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1" }),
}))

const { POST } = await import("@/app/api/storage/course-thumbnail-from-url/route")

function createMockRequest(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe("POST /api/storage/course-thumbnail-from-url", () => {
  it("fetches image from URL and returns public storage URL", async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any)

    mockUpload.mockResolvedValue({ error: null })

    const response = await POST(createMockRequest({
      url: "https://example.com/image.jpg",
    }))

    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.url).toContain("course-thumbnails/")
    expect(data.url).toContain(".jpg")

    vi.restoreAllMocks()
  })

  it("rejects non-image URLs", async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("not-an-image")),
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any)

    const response = await POST(createMockRequest({
      url: "https://example.com/page.html",
    }))

    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toContain("does not point to an image")

    vi.restoreAllMocks()
  })

  it("rejects invalid URL", async () => {
    const response = await POST(createMockRequest({
      url: "not-a-valid-url",
    }))

    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toContain("Invalid image URL")
  })

  it("rejects unreachable URL", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"))

    const response = await POST(createMockRequest({
      url: "https://example.com/missing.jpg",
    }))

    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toContain("Could not reach")

    vi.restoreAllMocks()
  })

  it("rejects oversized images", async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024)
    const mockResponse = {
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: vi.fn().mockResolvedValue(largeBuffer),
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any)

    const response = await POST(createMockRequest({
      url: "https://example.com/large.jpg",
    }))

    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toContain("too large")

    vi.restoreAllMocks()
  })

  it("handles storage upload failure", async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any)

    mockUpload.mockResolvedValue({ error: { message: "Storage error" } })

    const response = await POST(createMockRequest({
      url: "https://example.com/image.jpg",
    }))

    const data = await response.json()
    expect(response.status).toBe(500)
    expect(data.error).toContain("Storage error")

    vi.restoreAllMocks()
  })
})
