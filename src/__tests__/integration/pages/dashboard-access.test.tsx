import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }) }))

import { createSupabaseServerClient } from "@/lib/supabase/server"
import AdminLayout from "@/app/admin/layout"
import InstructorLayout from "@/app/instructor/layout"
import StudentLayout from "@/app/student/layout"

beforeEach(() => vi.clearAllMocks())

describe("unchanged dashboard layout and real active-profile guards", () => {
  const layouts = [
    { role: "super_admin", layout: AdminLayout },
    { role: "instructor", layout: InstructorLayout },
    { role: "student", layout: StudentLayout },
  ]
  for (const { role, layout } of layouts) {
    it.each(["inactive", "suspended"])(`${role} layout rejects %s profile`, async (status) => {
      const { mock } = createSupabaseMock()
      mock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
      mock.from("profiles").single.mockResolvedValue({ data: { id: "profile-1", role, status }, error: null })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)
      await expect(layout({ children: null })).rejects.toThrow("REDIRECT:/login")
    })

    it(`${role} layout accepts an active matching profile`, async () => {
      const { mock } = createSupabaseMock()
      mock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
      mock.from("profiles").single.mockResolvedValue({ data: { id: "profile-1", role, status: "active" }, error: null })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)
      await expect(layout({ children: null })).resolves.toBeTruthy()
    })
  }
})
