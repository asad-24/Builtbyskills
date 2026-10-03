import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
import { requireRole } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"
import { POST as progress } from "@/app/api/student/progress/route"
import { GET as download } from "@/app/api/student/resources/[resourceId]/route"
import { getStudentLessonData } from "@/features/student/player-data"

const id = "550e8400-e29b-41d4-a716-446655440001"
const student = "550e8400-e29b-41d4-a716-446655440002"
const now = "2026-10-01T12:00:00.000Z"
function requestProgress(body = { lessonId: id, progressSeconds: 120, completed: true }) { return new NextRequest("https://example.com/api/student/progress", { method: "POST", body: JSON.stringify(body) }) }
function setup(lessonOverrides = {}, enrollmentOverrides = {}) {
  const { mock } = createSupabaseMock()
  const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example.com/private-file?token=short-lived" }, error: null })
  const bucket = vi.fn(() => ({ createSignedUrl: sign }))
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ ...mock, storage: { from: bucket } } as never)
  mock.from("lessons").single.mockResolvedValue({ data: { id, status: "published", lesson_type: "video", mux_playback_id: "legacy-playback", duration_seconds: 300, section: { course_id: id }, ...lessonOverrides }, error: null })
  mock.from("enrollments").single.mockResolvedValue({ data: { id: "enrollment", student_id: student, course_id: id, status: "active", starts_at: null, expires_at: null, ...enrollmentOverrides }, error: null })
  mock.from("lesson_resources").single.mockResolvedValue({ data: { id, lesson_id: id, title: "Handout.pdf", file_path: "legacy/private.pdf", resource_type: "application/pdf" }, error: null })
  mock.from("lesson_resources").setResolveWith([{ id, lesson_id: id, title: "Handout.pdf" }])
  mock.from("courses").single.mockResolvedValue({ data: { id, status: "published", course_sections: [{ id, position: 1, lessons: [{ id: "published", status: "published", position: 1 }, { id: "draft", status: "draft", position: 2 }, { id: "archived", status: "archived", position: 3 }] }] }, error: null })
  return { mock, sign, bucket }
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)); vi.mocked(requireRole).mockResolvedValue({ id: student, role: "student" } as never) })
afterEach(() => vi.useRealTimers())
const paths = {
  progress: () => progress(requestProgress()),
  download: () => download(new Request("https://example.com"), { params: Promise.resolve({ resourceId: id }) }),
}
describe("published enrolled lesson authorization", () => {
  it.each(["draft", "unpublished", "archived"])("denies a %s parent course in page, resources and progress", async status => {
    const { mock, sign } = setup()
    mock.from("courses").single.mockResolvedValue({ data: { id, status }, error: null })
    expect((await getStudentLessonData(id)).ok).toBe(false)
    for (const call of Object.values(paths)) expect((await call()).status).toBe(403)
    expect(sign).not.toHaveBeenCalled()
    expect(mock.from("lesson_progress").upsert).not.toHaveBeenCalled()
  })
  it.each([new AppAuthError(), new AppForbiddenError("This account is not active.")])("denies the lesson page before database access when student authorization fails: %s", async error => {
    vi.mocked(requireRole).mockRejectedValue(error)
    expect((await getStudentLessonData(id)).ok).toBe(false)
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
  it("returns only an authorized YouTube ID and preserves saved resume/completion", async () => {
    const { mock } = setup({ youtube_video_id: "dQw4w9WgXcQ" })
    mock.from("lesson_progress").maybeSingle.mockResolvedValue({ data: { progress_seconds: 120, is_completed: true }, error: null })
    const result = await getStudentLessonData(id)
    if (!result.ok) throw new Error(result.message)
    expect(result.data.lesson.youtube_video_id).toBe("dQw4w9WgXcQ")
    expect(result.data.progress).toEqual({ progress_seconds: 120, is_completed: true })
    expect(mock.from("lesson_progress").eq).toHaveBeenCalledWith("student_id", student)
    expect(mock.from("lesson_progress").eq).toHaveBeenCalledWith("lesson_id", id)
  })
  it("denies a student with no enrollment for the lesson's exact course", async () => {
    const { mock } = setup({ youtube_video_id: "dQw4w9WgXcQ" })
    mock.from("enrollments").single.mockResolvedValue({ data: null, error: null })
    expect((await getStudentLessonData(id)).ok).toBe(false)
    expect((await paths.progress()).status).toBe(403)
    expect(mock.from("enrollments").eq).toHaveBeenCalledWith("course_id", id)
    expect(mock.from("lesson_progress").upsert).not.toHaveBeenCalled()
  })
  it.each(Object.entries(paths))("requires student authorization for %s", async (_label, call) => {
    vi.mocked(requireRole).mockRejectedValue(new AppForbiddenError())
    expect((await call()).status).toBe(403)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
  it.each(["draft", "archived"])("denies %s content in every privileged entry point even with preview enabled", async status => {
    const { mock, sign } = setup({ status, is_preview: true })
    for (const call of Object.values(paths)) expect((await call()).status).toBe(403)
    expect((await getStudentLessonData(id)).ok).toBe(false)
    expect(mock.from("lesson_progress").upsert).not.toHaveBeenCalled()
    expect(sign).not.toHaveBeenCalled()
  })
  it.each([
    { status: "pending" }, { status: "suspended" }, { starts_at: "2026-10-01T12:00:00.001Z" }, { expires_at: now },
  ])("denies inactive or out-of-window enrollment: %j", async window => {
    const { mock, sign } = setup({}, window)
    for (const call of Object.values(paths)) expect((await call()).status).toBe(403)
    expect((await getStudentLessonData(id)).ok).toBe(false)
    expect(mock.from("lesson_progress").upsert).not.toHaveBeenCalled()
    expect(sign).not.toHaveBeenCalled()
  })
  it("allows inclusive-start enrollment and preserves exact-course authorization", async () => {
    const { mock } = setup({}, { starts_at: now, expires_at: "2026-10-01T12:00:00.001Z" })
    expect((await getStudentLessonData(id)).ok).toBe(true)
    expect(mock.from("lessons").eq).toHaveBeenCalledWith("status", "published")
    expect(mock.from("enrollments").eq).toHaveBeenCalledWith("student_id", student)
    expect(mock.from("enrollments").eq).toHaveBeenCalledWith("course_id", id)
  })
  it("preserves progress/completion for published non-video lessons", async () => {
    const { mock } = setup({ lesson_type: "text", duration_seconds: 0 })
    expect((await progress(requestProgress({ lessonId: id, progressSeconds: 0, completed: true }))).status).toBe(200)
    expect(mock.from("lesson_progress").upsert).toHaveBeenCalledWith(expect.objectContaining({ student_id: student, lesson_id: id, enrollment_id: "enrollment", completion_percentage: 100, is_completed: true }), { onConflict: "student_id,lesson_id" })
  })
  it("uses YouTube duration without changing lesson metadata or progress identity", async () => {
    const { mock } = setup({ youtube_video_id: "dQw4w9WgXcQ", duration_seconds: 0 })
    const request = new NextRequest("https://example.com/api/student/progress", { method: "POST", body: JSON.stringify({ lessonId: id, progressSeconds: 120, durationSeconds: 300, completed: false }) })
    expect((await progress(request)).status).toBe(200)
    expect(mock.from("lesson_progress").upsert).toHaveBeenCalledWith(expect.objectContaining({ student_id: student, enrollment_id: "enrollment", completion_percentage: 40, is_completed: false }), { onConflict: "student_id,lesson_id" })
    expect(mock.from("lessons").update).not.toHaveBeenCalled()
  })
  it("does not undo existing completion when another playback tick arrives", async () => {
    const { mock } = setup()
    mock.from("lesson_progress").maybeSingle.mockResolvedValue({ data: { is_completed: true, completed_at: now }, error: null })
    expect((await progress(requestProgress({ lessonId: id, progressSeconds: 150, completed: false }))).status).toBe(200)
    expect(mock.from("lesson_progress").upsert).toHaveBeenCalledWith(expect.objectContaining({ is_completed: true, completed_at: now, completion_percentage: 100 }), expect.anything())
  })
  it("loads only published curriculum after authorization", async () => {
    setup()
    const result = await getStudentLessonData(id)
    if (!result.ok) throw new Error(result.message)
    expect(result.data.course.course_sections?.[0].lessons?.map(lesson => lesson.id)).toEqual(["published"])
  })
  it("signs private legacy resource paths for 60 seconds", async () => {
    const { sign, bucket } = setup()
    const response = await paths.download()
    expect(response.status).toBe(307)
    expect(bucket).toHaveBeenCalledWith("lesson-resources")
    expect(sign).toHaveBeenCalledWith("legacy/private.pdf", 60, { download: "Handout.pdf" })
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
  it.each(["javascript:alert(1)", "data:text/html,unsafe", "https://user:pass@example.com"])("denies unsafe legacy external resource %s", async file_path => {
    const { mock, sign } = setup()
    mock.from("lesson_resources").single.mockResolvedValue({ data: { lesson_id: id, file_path, resource_type: "external_link" }, error: null })
    expect((await paths.download()).status).toBe(404)
    expect(sign).not.toHaveBeenCalled()
  })
  it("opens external links only after lesson authorization", async () => {
    const { mock, sign } = setup()
    mock.from("lesson_resources").single.mockResolvedValue({ data: { lesson_id: id, file_path: "https://example.com/video", resource_type: "external_link" }, error: null })
    const response = await paths.download()
    expect(response.status).toBe(307)
    expect(response.headers.get("Location")).toBe("https://example.com/video")
    expect(sign).not.toHaveBeenCalled()
  })
  it("returns friendly progress validation and database failure messages", async () => {
    const { mock } = setup()
    const invalid = await progress(requestProgress({ lessonId: "invalid", progressSeconds: -1, completed: true }))
    expect(invalid.status).toBe(400)
    expect(JSON.stringify(await invalid.json())).not.toMatch(/Zod|invalid_type|path|code/)
    mock.from("lesson_progress").setResolveWith(null, { message: "secret database error" })
    const response = await paths.progress()
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain("secret")
  })
})
