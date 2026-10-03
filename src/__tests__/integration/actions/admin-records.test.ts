import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { deleteInstructorAction, updateInstructorAction, deleteContactSubmissionAction, deletePaymentMethodAction } from "@/actions/admin-records"
const id = "11111111-1111-4111-8111-111111111111"
const timestamp = "2026-10-02T12:00:00.000Z"
function form(extra: Record<string, string> = {}) { const f = new FormData(); Object.entries({ id, updated_at: timestamp, confirmed: "true", ...extra }).forEach(([k,v]) => f.set(k,v)); return f }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue({ id: "admin" } as never) })
describe("guarded admin mutations", () => {
  for (const action of [deleteInstructorAction, deleteContactSubmissionAction, deletePaymentMethodAction, updateInstructorAction]) {
    it(`${action.name} rejects unauthorized requests before database access`, async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new Error("forbidden"))
      expect((await action(undefined, form())).ok).toBe(false)
      expect(createSupabaseAdminClient).not.toHaveBeenCalled()
    })
  }
  it("requires confirmation and valid identity", async () => {
    expect((await deleteContactSubmissionAction(undefined, form({ confirmed: "false" }))).ok).toBe(false)
    expect((await deleteContactSubmissionAction(undefined, form({ id: "bad" }))).ok).toBe(false)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
  for (const [action, table] of [[deleteInstructorAction, "profiles"], [deleteContactSubmissionAction, "contact_submissions"]] as const) {
    it(`${action.name} changes only the selected version and rejects double deletion`, async () => {
      const { mock, tableChains } = createSupabaseMock()
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
      mock.from(table)
      const chain = tableChains.get(table)!.chain
      chain.maybeSingle.mockResolvedValueOnce({ data: { id }, error: null }).mockResolvedValueOnce({ data: null, error: null })
      expect((await action(undefined, form())).ok).toBe(true)
      expect((await action(undefined, form())).ok).toBe(false)
      expect(chain.eq).toHaveBeenCalledWith("id", id)
      expect(chain.eq).toHaveBeenCalledWith("updated_at", timestamp)
      if (table === "profiles") {
        expect(chain.update).toHaveBeenCalledWith({ status: "inactive" })
        expect(chain.eq).toHaveBeenCalledWith("role", "instructor")
        expect(chain.delete).not.toHaveBeenCalled()
      } else expect(chain.delete).toHaveBeenCalled()
      expect(mock.auth.admin.deleteUser).not.toHaveBeenCalled()
      expect([...tableChains.keys()]).toEqual([table, "audit_logs"])
    })
  }
  it("edits instructor profile fields without touching auth or assignments", async () => {
    const { mock, tableChains } = createSupabaseMock(); mock.from("profiles")
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
    tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: { id }, error: null })
    expect((await updateInstructorAction(undefined, form({ full_name: "New Name", phone: "123", whatsapp: "456", status: "active", email: "ignored@example.com" }))).ok).toBe(true)
    expect(tableChains.get("profiles")!.chain.update).toHaveBeenCalledWith({ full_name: "New Name", phone: "123", whatsapp: "456", status: "active" })
    expect([...tableChains.keys()]).toEqual(["profiles", "audit_logs"])
  })
  it("uses atomic payment deletion and explains historical references", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null }).mockResolvedValueOnce({ data: null, error: { code: "23503" } })
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc } as never)
    expect((await deletePaymentMethodAction(undefined, form())).ok).toBe(true)
    expect((await deletePaymentMethodAction(undefined, form())).ok).toBe(false)
    expect((await deletePaymentMethodAction(undefined, form())).message).toContain("Deactivate")
    expect(rpc).toHaveBeenCalledWith("delete_unreferenced_payment_method", { target_id: id, expected_updated_at: timestamp, actor_profile_id: "admin" })
  })
})
