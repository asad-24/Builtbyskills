import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))

import { getStudentDashboardData } from "@/features/student/data"
import { requireRole } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AppForbiddenError } from "@/lib/errors"

const studentId = "student-1"
const courseA = "10000000-0000-4000-8000-000000000001"
const courseB = "10000000-0000-4000-8000-000000000002"
const now = "2026-09-14T12:00:00.000Z"

function enrollment(courseId = courseA, overrides: Record<string, unknown> = {}) {
  return {
    id: `enrollment-${courseId}`, student_id: studentId, course_id: courseId,
    status: "active", starts_at: null, expires_at: null,
    course: { id: courseId, title: courseId, slug: courseId }, ...overrides,
  }
}

// Query-behavior double, not a PostgreSQL/RLS emulator. Mixed fixtures are
// returned only when the real loader supplies matching authorization filters.
function database(enrollments = [enrollment()], failedTable?: string) {
  type Row = Record<string, any>
  const tables: Record<string, Row[]> = {
    enrollments: [...enrollments, enrollment(courseB, { student_id: "other-student" })],
    lesson_progress: [{ id: "own-progress", student_id: studentId }, { id: "other-progress", student_id: "other-student" }],
    payment_submissions: [{ id: "own-payment", student_id: studentId }, { id: "other-payment", student_id: "other-student" }],
    live_classes: [
      { id: "live-b", course_id: courseB, starts_at: "2026-09-15T12:00:00.000Z" },
      { id: "live-a", course_id: courseA, starts_at: "2026-09-16T12:00:00.000Z" },
      { id: "past-a", course_id: courseA, starts_at: "2026-09-13T12:00:00.000Z" },
    ],
    announcements: [
      { id: "announcement-b", course_id: courseB, is_published: true },
      { id: "announcement-a", course_id: courseA, is_published: true },
      { id: "global", course_id: null, is_published: true },
      { id: "draft-global", course_id: null, is_published: false },
      { id: "draft-a", course_id: courseA, is_published: false },
    ],
    course_sections: [
      { id: "section-a", course_id: courseA, lessons: [{ id: "lesson-a" }] },
      { id: "section-b", course_id: courseB, lessons: [{ id: "lesson-b" }] },
    ],
  }
  const queries: Record<string, ReturnType<typeof query>> = {}
  function query(table: string) {
    let rows = tables[table] ?? []
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return chain }),
      in: vi.fn((column: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[column])); return chain }),
      is: vi.fn((column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return chain }),
      or: vi.fn((expression: string) => {
        const match = /^course_id\.is\.null,course_id\.in\.\(([^)]+)\)$/.exec(expression)
        if (!match) throw new Error(`Unexpected authorization filter: ${expression}`)
        const ids = match[1].split(",")
        rows = rows.filter((row) => row.course_id === null || ids.includes(row.course_id))
        return chain
      }),
      gte: vi.fn((column: string, value: string) => { rows = rows.filter((row) => row[column] >= value); return chain }),
      order: vi.fn(() => chain),
      limit: vi.fn((count: number) => { rows = rows.slice(0, count); return chain }),
      then: (resolve: (value: { data: Row[] | null; error: Error | null }) => unknown) =>
        Promise.resolve({ data: failedTable === table ? null : rows, error: failedTable === table ? new Error("Query failed") : null }).then(resolve),
    }
    return chain
  }
  const from = vi.fn((table: string) => {
    queries[table] = query(table)
    return queries[table]
  })
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createSupabaseAdminClient>)
  return { queries, from }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(now))
  vi.mocked(requireRole).mockResolvedValue({ id: studentId, role: "student", status: "active" } as Awaited<ReturnType<typeof requireRole>>)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe("student dashboard course authorization", () => {
  it("returns only Course A sessions, published Course A/global updates and authorized curriculum", async () => {
    const { queries } = database([enrollment(), enrollment(courseB, { status: "pending" })])
    const result = await getStudentDashboardData()
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(queries.enrollments.eq).toHaveBeenCalledWith("student_id", studentId)
    expect(queries.enrollments.select).toHaveBeenCalledWith("*, course:courses(*)")
    expect(queries.live_classes.in).toHaveBeenCalledWith("course_id", [courseA])
    expect(queries.announcements.or).toHaveBeenCalledWith(`course_id.is.null,course_id.in.(${courseA})`)
    expect(queries.announcements.eq).toHaveBeenCalledWith("is_published", true)
    expect(queries.course_sections.in).toHaveBeenCalledWith("course_id", [courseA])
    expect(result.data.liveClasses.map((row) => row.id)).toEqual(["live-a"])
    expect(result.data.announcements.map((row) => row.id)).toEqual(["announcement-a", "global"])
    expect(result.data.enrollments[0].course?.course_sections[0].lessons).toEqual([{ id: "lesson-a" }])
    expect(result.data.enrollments[1].course?.course_sections).toEqual([])
    expect(result.data.enrollments).toHaveLength(2) // Keep own pending enrollment history.
    expect(result.data.progress.map((row) => row.id)).toEqual(["own-progress"])
    expect(result.data.payments.map((row) => row.id)).toEqual(["own-payment"])
    expect(Object.keys(result.data).sort()).toEqual(["announcements", "enrollments", "liveClasses", "payments", "profile", "progress"])
    expect(queries.live_classes.limit).toHaveBeenCalledWith(10)
    expect(queries.announcements.limit).toHaveBeenCalledWith(10)
  })

  it.each([
    ["expired", { expires_at: "2026-09-14T11:59:59.999Z" }],
    ["expiry instant (exclusive)", { expires_at: now }],
    ["future start", { starts_at: "2026-09-14T12:00:00.001Z" }],
    ...["pending", "suspended", "completed", "expired", "cancelled"].map((status): [string, Record<string, unknown>] => [status, { status }]),
  ])("does not grant course access for %s enrollment", async (_label, overrides) => {
    const { from, queries } = database([enrollment(courseA, overrides)])
    const result = await getStudentDashboardData()
    if (!result.ok) throw new Error(result.message)
    expect(result.data.liveClasses).toEqual([])
    expect(result.data.announcements.map((row) => row.id)).toEqual(["global"])
    expect(result.data.enrollments[0].course?.course_sections).toEqual([])
    expect(from).not.toHaveBeenCalledWith("live_classes")
    expect(from).not.toHaveBeenCalledWith("course_sections")
    expect(queries.announcements.is).toHaveBeenCalledWith("course_id", null)
    expect(queries.announcements.or).not.toHaveBeenCalled()
  })

  it("returns valid empty course data when only another student is enrolled", async () => {
    database([])
    const result = await getStudentDashboardData()
    if (!result.ok) throw new Error(result.message)
    expect(result.data.enrollments).toEqual([])
    expect(result.data.liveClasses).toEqual([])
    expect(result.data.announcements.map((row) => row.id)).toEqual(["global"])
  })

  it.each([
    { starts_at: now, expires_at: "2026-09-14T12:00:00.001Z" },
    { starts_at: null, expires_at: null },
  ])("allows inclusive start and open-ended time windows: %j", async (window) => {
    database([enrollment(courseA, window)])
    const result = await getStudentDashboardData()
    if (!result.ok) throw new Error(result.message)
    expect(result.data.liveClasses.map((row) => row.id)).toEqual(["live-a"])
  })

  it("includes every authorized course", async () => {
    const { queries } = database([enrollment(), enrollment(courseB)])
    const result = await getStudentDashboardData()
    if (!result.ok) throw new Error(result.message)
    expect(queries.live_classes.in).toHaveBeenCalledWith("course_id", [courseA, courseB])
    expect(result.data.liveClasses.map((row) => row.id)).toEqual(["live-b", "live-a"])
  })

  it("fails closed before course queries when enrollment lookup fails", async () => {
    const { from } = database([], "enrollments")
    expect(await getStudentDashboardData()).toEqual({ ok: false, reason: "error", message: "Query failed" })
    expect(from).not.toHaveBeenCalledWith("live_classes")
    expect(from).not.toHaveBeenCalledWith("announcements")
    expect(from).not.toHaveBeenCalledWith("course_sections")
  })

  it.each(["live_classes", "announcements", "course_sections"])("preserves errors from %s", async (table) => {
    database([enrollment()], table)
    expect(await getStudentDashboardData()).toEqual({ ok: false, reason: "error", message: "Query failed" })
  })

  it("does not create a privileged client when student authorization fails", async () => {
    vi.mocked(requireRole).mockRejectedValue(new AppForbiddenError())
    const result = await getStudentDashboardData()
    expect(result.ok).toBe(false)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
})
