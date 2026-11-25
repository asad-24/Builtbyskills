import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
const state = vi.hoisted(() => ({ name: "test", client: {}, findOne: vi.fn(), createIndex: vi.fn(), updateOne: vi.fn() }))
vi.mock("@/lib/database/connection", () => ({
  mongoClient: () => state.client,
  mongoDb: () => ({ databaseName: state.name, collection: () => ({ findOne: state.findOne, createIndex: state.createIndex, updateOne: state.updateOne }) }),
}))
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); state.name = "test"; state.client = {}; state.findOne.mockResolvedValue({ version: 1 }); state.createIndex.mockResolvedValue("index"); state.updateOne.mockResolvedValue({}) })
describe("database readiness", () => {
  it("checks readiness once per connection/database and never creates indexes during runtime reads", async () => {
    const { ensureDatabaseReady } = await import("@/lib/database/schema")
    await Promise.all([ensureDatabaseReady(), ensureDatabaseReady()])
    await ensureDatabaseReady()
    expect(state.findOne).toHaveBeenCalledTimes(1)
    expect(state.createIndex).not.toHaveBeenCalled()
    expect(state.updateOne).not.toHaveBeenCalled()
    state.name = "another-test"
    await ensureDatabaseReady()
    state.client = {}
    await ensureDatabaseReady()
    expect(state.findOne).toHaveBeenCalledTimes(3)
  })
  it("fails closed when setup is incomplete and can recover after explicit preparation", async () => {
    const { ensureDatabaseReady } = await import("@/lib/database/schema")
    state.findOne.mockResolvedValueOnce(null)
    await expect(ensureDatabaseReady()).rejects.toMatchObject({ code: "DATABASE_NOT_READY" })
    await expect(ensureDatabaseReady()).resolves.toBeUndefined()
    expect(state.createIndex).not.toHaveBeenCalled()
  })
  it("shares readiness across separately loaded module graphs for the same process", async () => {
    const first = await import("@/lib/database/schema")
    await first.ensureDatabaseReady()
    vi.resetModules()
    const second = await import("@/lib/database/schema")
    await second.ensureDatabaseReady()
    expect(state.findOne).toHaveBeenCalledTimes(1)
  })
  it("writes the version marker only after explicit index preparation completes", async () => {
    const { ensureIndexes, ensureDatabaseReady } = await import("@/lib/database/schema")
    await ensureIndexes()
    expect(state.createIndex).toHaveBeenCalled()
    expect(state.updateOne).toHaveBeenCalledWith({ _id: "schema" }, { $set: { version: 1, prepared_at: expect.any(Date) } }, { upsert: true })
    await ensureDatabaseReady()
    expect(state.findOne).not.toHaveBeenCalled()
  })
  it("does not advertise readiness when index preparation fails", async () => {
    const { ensureIndexes } = await import("@/lib/database/schema")
    state.createIndex.mockRejectedValueOnce(new Error("Setup failed"))
    await expect(ensureIndexes()).rejects.toThrow("Setup failed")
    expect(state.updateOne).not.toHaveBeenCalled()
  })
})
