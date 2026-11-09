import { beforeEach, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
const context = vi.hoisted(() => ({ headers: new Headers(), cookie: "", getSession: vi.fn(), signOut: vi.fn(), signInEmail: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => context.headers, cookies: async () => ({ getAll: () => context.cookie ? [{ name: "session", value: context.cookie }] : [] }) }))
vi.mock("@/lib/database/auth", () => ({ getAuth: () => ({ api: { getSession: context.getSession, signOut: context.signOut, signInEmail: context.signInEmail } }) }))
vi.mock("@/lib/database/client", () => ({ DatabaseClient: class { auth = {}; constructor() {} } }))
import { createDatabaseServerClient } from "@/lib/database/server"
beforeEach(() => {
  vi.clearAllMocks(); context.headers = new Headers(); context.cookie = "before-login"
  context.getSession.mockImplementation(async ({ headers }: { headers: Headers }) => ({ user: { id: headers.get("cookie") } }))
})
it("reuses the same client and identity lookup only within one request", async () => {
  const first = await createDatabaseServerClient(), second = await createDatabaseServerClient()
  expect(first).toBe(second)
  await first.auth.getUser(); await second.auth.getUser()
  expect(context.getSession).toHaveBeenCalledTimes(1)
  context.headers = new Headers()
  const otherRequest = await createDatabaseServerClient()
  expect(otherRequest).not.toBe(first)
  await otherRequest.auth.getUser()
  expect(context.getSession).toHaveBeenCalledTimes(2)
})
it("reads freshly set login cookies instead of returning an earlier identity", async () => {
  const client = await createDatabaseServerClient()
  expect((await client.auth.getUser()).data.user.id).toBe("session=before-login")
  context.signInEmail.mockImplementation(async () => { context.cookie = "after-login" })
  await client.auth.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" })
  expect((await client.auth.getUser()).data.user.id).toBe("session=after-login")
  expect(context.getSession).toHaveBeenCalledTimes(2)
})
it("signs out the current session after a login cookie changes in the same action", async () => {
  const client = await createDatabaseServerClient()
  context.cookie = "fresh-session"
  await client.auth.signOut()
  expect(context.signOut).toHaveBeenCalledWith({ headers: expect.any(Headers) })
  expect(context.signOut.mock.calls[0][0].headers.get("cookie")).toBe("session=fresh-session")
})
