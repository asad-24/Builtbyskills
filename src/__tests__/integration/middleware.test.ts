import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const { getSession, findOne } = vi.hoisted(() => ({ getSession: vi.fn(), findOne: vi.fn() }))
vi.mock("@/lib/database/auth", () => ({ getAuth: () => ({ api: { getSession } }) }))
vi.mock("@/lib/database/connection", () => ({ mongoDb: () => ({ collection: () => ({ findOne }) }) }))
import { proxy } from "@/proxy"
beforeEach(() => { vi.clearAllMocks(); getSession.mockResolvedValue(null); findOne.mockResolvedValue(null) })
describe("MongoDB session and role protection", () => {
  it.each(["/", "/login", "/register", "/courses/amazon", "/courses/", "/enroll", "/api/student/classes/id"])("allows public or handler-authorized route %s", async path => {
    expect((await proxy(new NextRequest(`https://academy.test${path}`))).status).toBe(200)
    expect(getSession).not.toHaveBeenCalled()
  })
  it.each(["/admin", "/instructor", "/student", "/courses-private"])("redirects unauthenticated protected route %s", async path => {
    const result = await proxy(new NextRequest(`https://academy.test${path}`))
    expect(result.status).toBe(307); expect(result.headers.get("location")).toBe("https://academy.test/login")
  })
  it.each([["super_admin", "/admin"], ["instructor", "/instructor"], ["student", "/student"]])("allows active %s at %s", async (role, path) => {
    getSession.mockResolvedValue({ user: { id: "verified-user", emailVerified: true } })
    findOne.mockResolvedValue({ role, status: "active" })
    expect((await proxy(new NextRequest(`https://academy.test${path}`))).headers.get("x-middleware-next")).toBe("1")
    expect(findOne).toHaveBeenCalledWith({ auth_user_id: "verified-user", status: "active" })
  })
  it("rejects a student visiting admin", async () => {
    getSession.mockResolvedValue({ user: { id: "student", emailVerified: true } }); findOne.mockResolvedValue({ role: "student" })
    expect((await proxy(new NextRequest("https://academy.test/admin"))).status).toBe(307)
  })
  it("rejects an unverified or disabled account", async () => {
    getSession.mockResolvedValue({ user: { id: "unverified", emailVerified: false } })
    expect((await proxy(new NextRequest("https://academy.test/student"))).status).toBe(307)
    expect(findOne).not.toHaveBeenCalled()
  })
  it("returns the action redirect protocol for an expired action session", async () => {
    const result = await proxy(new NextRequest("https://academy.test/admin/course-builder/id", { method: "POST", headers: { "next-action": "save-lesson" } }))
    expect(result.status).toBe(200); expect(result.headers.get("x-action-redirect")).toBe("/login;replace"); expect(result.headers.has("location")).toBe(false)
  })
})
