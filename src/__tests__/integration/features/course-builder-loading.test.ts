import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
import { AppForbiddenError } from "@/lib/errors"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))

import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getCourseBuilderData } from "@/features/admin/data"

const legacyLesson = { id: "lesson", youtube_video_id: "abcdefghijk", lesson_resources: [{ id: "resource" }] }
const legacySections = [{ id: "section", lessons: [legacyLesson] }]

function setup(sections: unknown = legacySections) {
  const { mock } = createSupabaseMock()
  vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
  mock.from("courses").single.mockResolvedValue({ data: { id: "course" }, error: null })
  mock.from("profiles").setResolveWith([{ id: "instructor" }])
  const curriculum = mock.from("course_sections")
  curriculum.setResolveWith(sections)
  return { mock, curriculum }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin", role: "super_admin", status: "active" } as never)
})

describe("Course Builder schema compatibility", () => {
  it("loads existing YouTube lessons and resources without querying R2 relationships", async () => {
    const { curriculum } = setup()
    const result = await getCourseBuilderData("course")
    expect(result).toEqual({ ok: true, data: { course: { id: "course" }, instructors: [{ id: "instructor" }], sections: legacySections } })
    expect(curriculum.select.mock.calls).toEqual([["*, lessons(*, lesson_resources(*))"]])
    expect(result.ok && result.data.sections[0].lessons?.[0]).not.toHaveProperty("video_upload")
  })

  it.each([{ sections: [] }, { sections: [{ id: "section", lessons: [] }] }])("loads an empty curriculum without querying R2 relationships", async ({ sections }) => {
    const { curriculum } = setup(sections)
    expect((await getCourseBuilderData("course")).ok).toBe(true)
    expect(curriculum.select).toHaveBeenCalledTimes(1)
  })

  it("preserves real R2 upload enrichment after the schema is available", async () => {
    const lesson = { ...legacyLesson, video_asset_id: null, video_source: "r2" }
    const { curriculum } = setup([{ id: "section", lessons: [lesson] }])
    curriculum.select.mockImplementationOnce(() => curriculum).mockImplementationOnce(() => {
      curriculum.setResolveWith([{ id: "section", lessons: [{ ...lesson, video_assets: [{
        id: "asset", state: "ready", original_name: "lesson.mp4", retired_at: null, created_at: "2026-10-03",
        lesson_video_uploads: { id: "upload", initiated_by: "admin", state: "validating" },
      }] }] }])
      return curriculum
    })
    const result = await getCourseBuilderData("course")
    expect(curriculum.select).toHaveBeenCalledTimes(2)
    expect(curriculum.select.mock.calls[1][0]).toContain("lesson_video_assets!lesson_video_assets_lesson_id_fkey")
    expect(result.ok && result.data.sections[0].lessons?.[0]).toEqual({ ...lesson, video_upload: { id: "upload", state: "ready", name: "lesson.mp4" } })
  })

  it("does not suppress enrichment errors when the schema columns are present", async () => {
    const { curriculum } = setup([{ lessons: [{ ...legacyLesson, video_asset_id: null, video_source: "r2" }] }])
    curriculum.select.mockImplementationOnce(() => curriculum).mockImplementationOnce(() => {
      curriculum.setResolveWith(null, { code: "PGRST200", message: "Broken R2 relationship" })
      return curriculum
    })
    expect(await getCourseBuilderData("course")).toMatchObject({ ok: false, reason: "error", message: "Broken R2 relationship" })
  })

  it("does not suppress existing curriculum query errors", async () => {
    const { curriculum } = setup()
    curriculum.setResolveWith(null, { message: "Curriculum query failed" })
    expect(await getCourseBuilderData("course")).toMatchObject({ ok: false, reason: "error", message: "Curriculum query failed" })
    expect(curriculum.select).toHaveBeenCalledTimes(1)
  })

  it("requires admin authorization before querying any curriculum", async () => {
    setup()
    vi.mocked(requireAdmin).mockRejectedValue(new AppForbiddenError())
    expect(await getCourseBuilderData("course")).toMatchObject({ ok: false, reason: "forbidden" })
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
})
