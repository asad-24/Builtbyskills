import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendTransactionalEmail } from "@/lib/email/send"
import { reviewPaymentAction } from "@/actions/admin"

const paymentId = "550e8400-e29b-41d4-a716-446655440000"
const prepared = { ok: true, auth_user_id: null, email: "student@example.com", full_name: "New Student" }
const committed = {
  ok: true, activation: true, email: prepared.email, full_name: prepared.full_name,
  receipt_id: "receipt-1", receipt_metadata: { status: "approved", student_id: "profile-1", auth_user_id: "auth-1" },
}
function form(status = "approved") {
  const data = new FormData()
  data.set("payment_id", paymentId)
  data.set("status", status)
  return data
}
function setup() {
  const { mock } = createSupabaseMock()
  const rpc = vi.fn()
  mock.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null })
  mock.auth.admin.generateLink.mockResolvedValue({ data: { properties: { action_link: "https://auth.example/verify?token=test&redirect_to=callback" } }, error: null })
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ ...mock, rpc } as unknown as ReturnType<typeof createSupabaseAdminClient>)
  return { mock, rpc }
}
function response(data: object) { return { data: structuredClone(data), error: null } }

describe("payment approval orchestration (mocked Auth, RPC and email)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-profile", role: "super_admin", status: "active" } as Awaited<ReturnType<typeof requireAdmin>>)
    vi.mocked(sendTransactionalEmail).mockResolvedValue({ ok: true, emailId: "email-1" })
  })

  it("creates Auth, commits DB linkage, then sends one Feature 4 activation link", async () => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response(prepared)).mockResolvedValueOnce(response(committed))
    const result = await reviewPaymentAction(undefined, form())
    expect(result.ok).toBe(true)
    expect(mock.auth.admin.createUser).toHaveBeenCalledExactlyOnceWith({
      email: prepared.email, email_confirm: true,
      user_metadata: { full_name: prepared.full_name, role: "student" }, app_metadata: { payment_provisioned: true },
    })
    expect(rpc).toHaveBeenLastCalledWith("approve_student_payment", {
      p_payment_id: paymentId, p_admin_id: "admin-profile", p_finalize: true, p_auth_user_id: "auth-1",
    })
    expect(mock.auth.admin.generateLink).toHaveBeenCalledExactlyOnceWith({
      type: "recovery", email: prepared.email, options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    })
    expect(sendTransactionalEmail).toHaveBeenCalledOnce()
    expect(vi.mocked(sendTransactionalEmail).mock.calls[0][0].html).toContain('href="https://auth.example/verify?token=test&amp;redirect_to=callback"')
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(mock.auth.admin.generateLink.mock.invocationCallOrder[0])
    expect(mock.from("profiles").upsert).not.toHaveBeenCalled()
  })

  it("reuses an existing Auth/student and sends only a payment confirmation", async () => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response({ ...prepared, auth_user_id: "existing-auth" }))
      .mockResolvedValueOnce(response({ ...committed, activation: false }))
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(true)
    expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
    expect(mock.auth.admin.generateLink).not.toHaveBeenCalled()
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: "Builtbyskills payment approved" }))
  })

  it.each(["identity_conflict", "invalid_state", "invalid_request", "missing_course", "enrollment_conflict", "incomplete_approval"])(
    "honors authoritative %s failure without any provisioning or email", async (reason) => {
      const { mock, rpc } = setup()
      rpc.mockResolvedValue(response({ ok: false, reason }))
      expect((await reviewPaymentAction(undefined, form())).ok).toBe(false)
      expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
      expect(mock.from).not.toHaveBeenCalled()
      expect(sendTransactionalEmail).not.toHaveBeenCalled()
    })

  it.each([false, true])("surfaces incomplete approved-state review without repair (finalization=%s)", async (finalization) => {
    const { mock, rpc } = setup()
    if (finalization) rpc.mockResolvedValueOnce(response({ ...prepared, auth_user_id: "auth-1" }))
    rpc.mockResolvedValueOnce(response({ ok: false, reason: "incomplete_approval" }))
    const result = await reviewPaymentAction(undefined, form())
    expect(result.ok).toBe(false)
    expect(result.message).toContain("Manual review is required")
    expect(rpc).toHaveBeenCalledTimes(finalization ? 2 : 1)
    expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
    expect(mock.auth.admin.generateLink).not.toHaveBeenCalled()
    expect(mock.from).not.toHaveBeenCalled()
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it("rejects a changed expected Auth identity during approved-state replay", async () => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response({ ...prepared, auth_user_id: "auth-1" }))
      .mockResolvedValueOnce(response({ ok: false, reason: "identity_changed" }))
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(false)
    expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
    expect(mock.from).not.toHaveBeenCalled()
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it("does not finalize after Auth creation failure", async () => {
    const { mock, rpc } = setup()
    rpc.mockImplementation(async () => response(prepared))
    mock.auth.admin.createUser.mockResolvedValue({ data: null, error: { message: "private internals" } })
    const result = await reviewPaymentAction(undefined, form())
    expect(result).toEqual({ ok: false, message: "Auth provisioning failed. Payment was not approved; retry safely." })
    expect(rpc.mock.calls.every(([, args]) => args.p_finalize === false)).toBe(true)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it("re-resolves and reuses the winner when concurrent Auth creation reports duplicate", async () => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response(prepared))
      .mockResolvedValueOnce(response({ ...prepared, auth_user_id: "concurrent-auth" }))
      .mockResolvedValueOnce(response(committed))
    mock.auth.admin.createUser.mockResolvedValue({ data: null, error: { code: "email_exists" } })
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(true)
    expect(rpc).toHaveBeenLastCalledWith("approve_student_payment", expect.objectContaining({ p_auth_user_id: "concurrent-auth" }))
  })

  it.each(["finalization_failed", "identity_changed"])("retries %s without creating Auth again", async (reason) => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response(prepared)).mockResolvedValueOnce(response({ ok: false, reason }))
      .mockResolvedValueOnce(response({ ...prepared, auth_user_id: "auth-1" })).mockResolvedValueOnce(response(committed))
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(false)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(true)
    expect(mock.auth.admin.createUser).toHaveBeenCalledOnce()
  })

  it.each(["sent", "failed", "pending"])("repeated approval with %s email does not provision or resend", async (email_status) => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValue(response({ ok: true, already_approved: true, email_status }))
    const result = await reviewPaymentAction(undefined, form())
    expect(result.ok).toBe(true)
    expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
    expect(mock.auth.admin.generateLink).not.toHaveBeenCalled()
    expect(mock.from).not.toHaveBeenCalled()
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
    if (email_status !== "sent") expect(result.message).toContain("Forgot password")
  })

  it("does not send when another transaction already finalized approval", async () => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response({ ...prepared, auth_user_id: "auth-1" }))
      .mockResolvedValueOnce(response({ ok: true, already_approved: true, email_status: "pending" }))
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(true)
    expect(mock.auth.admin.generateLink).not.toHaveBeenCalled()
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it.each(["returned", "thrown", "link"])("reports partial success after %s email failure and does not retry provisioning", async (kind) => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response(prepared)).mockResolvedValueOnce(response(committed))
      .mockResolvedValueOnce(response({ ok: true, already_approved: true, email_status: "failed" }))
    if (kind === "returned") vi.mocked(sendTransactionalEmail).mockResolvedValue({ ok: false, skipped: false, message: "private", emailId: null })
    if (kind === "thrown") vi.mocked(sendTransactionalEmail).mockRejectedValue(new Error("private"))
    if (kind === "link") mock.auth.admin.generateLink.mockResolvedValue({ data: null, error: { message: "private" } })
    const result = await reviewPaymentAction(undefined, form())
    expect(result.ok).toBe(true)
    expect(result.message).toContain("email delivery could not be confirmed")
    expect(mock.from("audit_logs").update).toHaveBeenCalledWith({ metadata: { ...committed.receipt_metadata, email_status: "failed" } })
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(true)
    expect(mock.auth.admin.createUser).toHaveBeenCalledOnce()
    expect(mock.auth.admin.generateLink).toHaveBeenCalledOnce()
  })

  it("does not turn an email receipt write failure into a failed approval", async () => {
    const { mock, rpc } = setup()
    rpc.mockResolvedValueOnce(response({ ...prepared, auth_user_id: "auth-1" })).mockResolvedValueOnce(response(committed))
    mock.from("audit_logs").setResolveWith(null, { message: "private" })
    const result = await reviewPaymentAction(undefined, form())
    expect(result.ok).toBe(true)
    expect(result.message).toContain("Email receipt could not be recorded")
  })

  it("reports an uncertain RPC response without falsely claiming rollback", async () => {
    const { rpc } = setup()
    rpc.mockResolvedValueOnce(response({ ...prepared, auth_user_id: "auth-1" })).mockRejectedValueOnce(new Error("secret"))
    const result = await reviewPaymentAction(undefined, form())
    expect(result.ok).toBe(false)
    expect(result.message).toContain("could not be confirmed")
    expect(result.message).not.toContain("secret")
  })

  it("rejects non-admins before creating a service-role client", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("private"))
    expect((await reviewPaymentAction(undefined, form())).ok).toBe(false)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it("rejects invalid input before any database/Auth calls", async () => {
    const { rpc } = setup()
    const data = form()
    data.set("payment_id", "invalid")
    expect((await reviewPaymentAction(undefined, data)).ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(["approved", "refunded"])("cannot reject or reopen a %s payment", async (status) => {
    const { mock } = setup()
    mock.from("payment_submissions").single.mockResolvedValue({ data: { id: paymentId, status }, error: null })
    expect((await reviewPaymentAction(undefined, form("rejected"))).ok).toBe(false)
    expect(mock.from("payment_submissions").update).not.toHaveBeenCalled()
  })

  it("detects a payment changed concurrently during non-approval review", async () => {
    const { mock } = setup()
    mock.from("payment_submissions").single.mockResolvedValue({ data: { id: paymentId, status: "pending" }, error: null })
    mock.from("payment_submissions").maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await reviewPaymentAction(undefined, form("under_review"))).ok).toBe(false)
    expect(mock.from("payment_submissions").eq).toHaveBeenCalledWith("status", "pending")
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })
})
