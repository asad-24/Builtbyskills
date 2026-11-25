import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Document } from "mongodb"
vi.mock("server-only", () => ({}))
const state = vi.hoisted(() => ({ guard: vi.fn(), ready: vi.fn(), collection: vi.fn(), aggregate: vi.fn(), count: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ requireAdminRead: state.guard }))
vi.mock("@/lib/database/schema", () => ({ ensureDatabaseReady: state.ready }))
vi.mock("@/lib/database/connection", () => ({ mongoDb: () => ({ collection: state.collection }) }))
import { AppForbiddenError } from "@/lib/errors"
import { getAdminOverviewData, getAdminReportsData, getAdminPaymentSettingsData, getAdminPaymentsData, getAdminStudentsData, getAdminEnrollmentsData } from "@/features/admin/read-models"

beforeEach(() => {
  vi.clearAllMocks(); state.guard.mockResolvedValue({ role: "super_admin", status: "active" }); state.ready.mockResolvedValue(undefined)
  state.aggregate.mockImplementation(() => ({ toArray: async () => [] }))
  state.count.mockResolvedValue(0)
  state.collection.mockReturnValue({ aggregate: state.aggregate, countDocuments: state.count })
})
describe("scoped admin read models", () => {
  it("loads payment settings with one query, without touching students, courses or counts", async () => {
    await expect(getAdminPaymentSettingsData()).resolves.toEqual({ ok: true, data: { paymentMethods: [] } })
    expect(state.collection).toHaveBeenCalledExactlyOnceWith("payment_methods")
    expect(state.count).not.toHaveBeenCalled()
  })
  it("loads joined payments in one database operation independently of the number of records", async () => {
    state.aggregate.mockReturnValue({ toArray: async () => Array.from({ length: 50 }, (_, id) => ({ id, course: { title: "Course" }, student: { full_name: "Student" } })) })
    const result = await getAdminPaymentsData()
    expect(result.ok && result.data.payments.length).toBe(50)
    expect(state.collection).toHaveBeenCalledExactlyOnceWith("payment_submissions")
    const pipeline = state.aggregate.mock.calls[0][0] as Document[]
    expect(pipeline.filter(p => p.$lookup).map(p => p.$lookup.from)).toEqual(["courses", "profiles"])
    expect(pipeline.find(p => p.$limit)?.$limit).toBe(50)
  })
  it("uses six stats operations and three bounded lists for overview", async () => {
    const result = await getAdminOverviewData()
    expect(result).toMatchObject({ ok: true, data: { stats: { totalStudents: 0, activeStudents: 0, pendingPayments: 0 } } })
    expect(state.collection).toHaveBeenCalledTimes(9)
    expect(state.aggregate.mock.calls.map(([pipeline]) => (pipeline as Document[]).find(p => p.$limit)?.$limit).filter(Boolean)).toEqual([6,6,8])
  })
  it("loads only statistics on reports", async () => {
    await getAdminReportsData()
    expect(state.collection).toHaveBeenCalledTimes(6)
    expect(state.aggregate).toHaveBeenCalledTimes(1)
  })
  it("keeps 50-row pages, uses a sentinel row for Next, and loads complete course options", async () => {
    state.collection.mockImplementation((table: string) => ({ aggregate: (pipeline: Document[]) => {
      state.aggregate(pipeline)
      return { toArray: async () => Array.from({ length: table === "profiles" ? 51 : 75 }, (_, id) => ({ id, title: "Course" })) }
    } }))
    const result = await getAdminStudentsData("2")
    expect(result).toMatchObject({ ok: true, data: { pagination: { page: 2, hasNext: true } } })
    if (!result.ok) throw new Error(result.message)
    expect(result.data.students).toHaveLength(50)
    expect(result.data.courses).toHaveLength(75)
    expect(state.aggregate.mock.calls[0][0]).toContainEqual({ $skip: 50 })
    expect(state.aggregate.mock.calls[0][0]).toContainEqual({ $limit: 51 })
  })
  it("retains assignment options beyond the first 500 people", async () => {
    state.collection.mockImplementation((table: string) => ({ aggregate: (pipeline: Document[]) => ({ toArray: async () => {
      if (table !== "profiles") return []
      const skip = pipeline.find(p => p.$skip)?.$skip ?? 0
      return Array.from({ length: skip === 0 ? 500 : 1 }, (_, id) => ({ id: skip+id, full_name: "Student", email: "synthetic@example.test", status: "active" }))
    } }) }))
    const result = await getAdminEnrollmentsData()
    expect(result.ok && result.data.studentOptions.length).toBe(501)
    expect(result.ok && result.data.studentOptions.at(-1)?.value).toBe(500)
  })
  it("performs no privileged database operations when authorization fails", async () => {
    state.guard.mockRejectedValueOnce(new AppForbiddenError())
    expect(await getAdminPaymentsData()).toMatchObject({ ok: false, reason: "forbidden" })
    expect(state.collection).not.toHaveBeenCalled()
    expect(state.ready).not.toHaveBeenCalled()
  })
})
