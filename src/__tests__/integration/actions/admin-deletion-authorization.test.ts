import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteCourseAction, deleteStudentAction, updateCoursePublicationAction } from "@/actions/admin"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AppForbiddenError } from "@/lib/errors"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockRejectedValue(new AppForbiddenError("Administrator required."))
})

describe("existing deletion authorization", () => {
  function data() {
    const form = new FormData()
    form.set("id", "11111111-1111-4111-8111-111111111111")
    form.set("status", "archived")
    return form
  }
  it("rejects course deletion before database access", async () => {
    await expect(deleteCourseAction(data())).rejects.toThrow("Administrator required.")
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
  it.each([deleteStudentAction, updateCoursePublicationAction])("%s rejects unauthorized mutation before database access", async action => {
    expect((await action(undefined, data())).ok).toBe(false)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
})
