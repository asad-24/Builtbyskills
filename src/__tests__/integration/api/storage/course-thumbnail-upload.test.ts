import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

const mockCreateSignedUploadUrl = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      })),
    },
  })),
}))

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1" }),
}))

const { POST } = await import("@/app/api/storage/course-thumbnail-upload/route")

function createMockRequest(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe("POST /api/storage/course-thumbnail-upload", () => {
  it("returns signed upload URL for valid request", async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { token: "signed-token-123" },
      error: null,
    })

    const response = await POST(createMockRequest({
      fileName: "thumb.jpg",
      contentType: "image/jpeg",
      size: 1024 * 1024,
    }))

    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.path).toContain("course-thumbnails/")
    expect(data.path).toContain(".jpg")
    expect(data.token).toBe("signed-token-123")
  })

  it("rejects oversized files", async () => {
    const response = await POST(createMockRequest({
      fileName: "large.jpg",
      contentType: "image/jpeg",
      size: 10 * 1024 * 1024,
    }))

    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toContain("5MB")
  })

  it("rejects unsupported file types", async () => {
    const response = await POST(createMockRequest({
      fileName: "doc.pdf",
      contentType: "application/pdf",
      size: 1024,
    }))

    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toContain("Unsupported file type")
  })

  it("rejects missing fields", async () => {
    const response = await POST(createMockRequest({}))

    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toContain("required")
  })
})
