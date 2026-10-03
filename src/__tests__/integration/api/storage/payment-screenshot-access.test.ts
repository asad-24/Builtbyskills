import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))

import { GET } from "@/app/api/admin/payments/[id]/screenshot/route"
import { requireAdmin } from "@/lib/auth/session"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseMock } from "@/test/mocks/supabase"

describe("Admin payment screenshot access", () => {
  const signedUrl = "https://example.supabase.co/storage/v1/object/sign/payment-screenshots/legacy/receipt.png?token=short-lived"
  const sign = vi.fn()
  let database: ReturnType<typeof createSupabaseMock>["mock"]
  const request = () => GET(new Request("http://localhost/api/admin/payments/payment-1/screenshot"), { params: Promise.resolve({ id: "payment-1" }) })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin" } as never)
    database = createSupabaseMock().mock
    database.from("payment_submissions").maybeSingle.mockResolvedValue({ data: { screenshot_path: "legacy/receipt.png" }, error: null })
    sign.mockResolvedValue({ data: { signedUrl }, error: null })
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ ...database, storage: { from: vi.fn(() => ({ createSignedUrl: sign })) } } as never)
  })

  it("opens the stored path for the selected payment using a 60-second private signed URL", async () => {
    const response = await request()
    expect(database.from).toHaveBeenCalledWith("payment_submissions")
    expect(database.from("payment_submissions").eq).toHaveBeenCalledWith("id", "payment-1")
    const client = vi.mocked(createSupabaseAdminClient).mock.results[0].value
    expect(client.storage.from).toHaveBeenCalledWith("payment-screenshots")
    expect(sign).toHaveBeenCalledWith("legacy/receipt.png", 60)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(signedUrl)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })

  it.each([
    [new AppAuthError(), 401],
    [new AppForbiddenError(), 403],
  ])("refuses unauthorized access before looking up or signing files", async (error, status) => {
    vi.mocked(requireAdmin).mockRejectedValue(error)
    const response = await request()
    expect(response.status).toBe(status)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
    expect(sign).not.toHaveBeenCalled()
  })

  it.each([null, { screenshot_path: null }, { screenshot_path: "" }])("returns not provided only for missing screenshots: %j", async (payment) => {
    database.from("payment_submissions").maybeSingle.mockResolvedValue({ data: payment, error: null })
    expect((await request()).status).toBe(404)
    expect(sign).not.toHaveBeenCalled()
  })

  it("reports unavailable storage separately from a missing screenshot", async () => {
    sign.mockResolvedValue({ data: null, error: { message: "Object unavailable" } })
    const response = await request()
    expect(response.status).toBe(502)
    expect((await response.json()).error).toContain("unavailable")
  })

  it("does not sign a screenshot if the payment lookup fails", async () => {
    database.from("payment_submissions").maybeSingle.mockResolvedValue({ data: null, error: { message: "Database unavailable" } })
    expect((await request()).status).toBe(500)
    expect(sign).not.toHaveBeenCalled()
  })
})
