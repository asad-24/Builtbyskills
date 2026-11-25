import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const { getSession, mongoDb } = vi.hoisted(() => ({ getSession: vi.fn(), mongoDb: vi.fn() }))
vi.mock("@/lib/database/auth", () => ({ getAuth: () => ({ api: { getSession } }) }))
vi.mock("@/lib/database/connection", () => ({ mongoDb }))
import { proxy } from "@/proxy"
describe("optimistic Proxy routing", () => {
  it.each(["/", "/login", "/register", "/courses/amazon", "/courses/", "/enroll", "/api/student/classes/id"])("allows public or handler-authorized route %s", async path => {
    expect((await proxy(new NextRequest(`https://academy.test${path}`))).status).toBe(200)
  })
  it.each(["/admin", "/instructor", "/student", "/courses-private"])("redirects missing-cookie protected route %s", async path => {
    const response = await proxy(new NextRequest(`https://academy.test${path}`))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://academy.test/login")
  })
  it.each(["better-auth.session_token", "__Secure-better-auth.session_token"])("passes %s cookies to authoritative server-side guards without database calls", async name => {
    const response = await proxy(new NextRequest("https://academy.test/admin", { headers: { cookie: `${name}=synthetic` } }))
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(getSession).not.toHaveBeenCalled()
    expect(mongoDb).not.toHaveBeenCalled()
  })
  it("returns the action redirect protocol when there is no session cookie", async () => {
    const response = await proxy(new NextRequest("https://academy.test/admin/course-builder/id", { method: "POST", headers: { "next-action": "save" } }))
    expect(response.status).toBe(200)
    expect(response.headers.get("x-action-redirect")).toBe("/login;replace")
    expect(response.headers.has("location")).toBe(false)
  })
})
