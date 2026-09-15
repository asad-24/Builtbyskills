import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash, webcrypto } from "node:crypto"
import { createBrowserClient } from "@supabase/ssr"
import { establishRecoverySession, recoveryError } from "@/lib/auth/password-recovery"
import { createSupabaseServerClient } from "@/lib/supabase/server"

vi.mock("server-only", () => ({}))
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    set: (name: string, value: string) => { if (value) jar.set(name, value); else jar.delete(name) },
  }),
}))

// Real installed Auth + SSR storage/PKCE logic; only HTTP and Next cookies are fake.
// All credentials below are synthetic and remain inside the test boundary.
describe("installed SSR PKCE recovery", () => {
  const starts: { redirect: string; challenge: string; method: string }[] = []
  let tokenCalls = 0
  beforeEach(() => {
    jar.clear()
    starts.length = 0
    tokenCalls = 0
    window.history.replaceState({}, "", "/reset-password")
    vi.stubGlobal("crypto", webcrypto)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://pkce-test.supabase.co")
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      const body = JSON.parse(String(init?.body ?? "{}"))
      if (url.pathname.endsWith("/recover")) {
        starts.push({ redirect: url.searchParams.get("redirect_to")!, challenge: body.code_challenge, method: body.code_challenge_method })
        return Response.json({})
      }
      if (url.pathname.endsWith("/token")) {
        tokenCalls++
        const start = starts[Number(body.auth_code)]
        if (start?.challenge) {
          const challenge = createHash("sha256").update(body.code_verifier).digest("base64url")
          if (challenge !== start.challenge) {
            return Response.json({ code: "bad_code_verifier", message: "Synthetic mismatch" }, { status: 400 })
          }
        }
        return Response.json({
          access_token: "synthetic-access", refresh_token: "synthetic-refresh",
          token_type: "bearer", expires_in: 3600,
          user: { id: "synthetic-user", aud: "authenticated" },
        })
      }
      throw new Error("Unexpected test HTTP operation")
    }))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); window.history.replaceState({}, "", "/") })

  async function start(enabled = true) {
    const client = await createSupabaseServerClient(enabled ? { passwordRecovery: true } : {})
    const { error } = await client.auth.resetPasswordForEmail("synthetic@example.test", {
      redirectTo: "http://localhost:3000/reset-password",
    })
    expect(error === null).toBe(true)
  }
  function browser() {
    return createBrowserClient("https://pkce-test.supabase.co", "synthetic-key", {
      isSingleton: false,
      auth: { detectSessionInUrl: false, autoRefreshToken: false },
      cookies: {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll: entries => entries.forEach(({ name, value }) => { if (value) jar.set(name, value); else jar.delete(name) }),
      },
    })
  }
  async function exchange(index: number) {
    const landing = new URL(starts[index].redirect)
    landing.searchParams.set("code", String(index))
    window.history.replaceState({}, "", landing.pathname + landing.search)
    return establishRecoverySession(browser(), new URL(window.location.href), false)
  }

  it.each([[0, 1], [1, 0]])("exchanges two independent flows in order %s then %s", async (first, second) => {
    await start()
    await start()
    const ids = starts.map(item => new URL(item.redirect).searchParams.get("sb_flow_id"))
    expect(ids.every(Boolean)).toBe(true)
    expect(ids[0] !== ids[1]).toBe(true)
    expect(starts.every(item => item.method === "s256")).toBe(true)
    expect((await exchange(first)) === "synthetic-user").toBe(true)
    expect((await exchange(second)) === "synthetic-user").toBe(true)
    expect(tokenCalls).toBe(2)
  })

  it("reproduces legacy overwrite and does not accept a session after a supplied credential fails", async () => {
    await start(false)
    await start(false)
    await expect(exchange(0)).rejects.toThrow(recoveryError)
    expect(tokenCalls).toBe(1)
  })

  it("does not borrow the shared verifier when a tagged slot is missing", async () => {
    await start()
    await start()
    const id = new URL(starts[0].redirect).searchParams.get("sb_flow_id")!
    for (const name of jar.keys()) if (name.includes("-flow-" + id + "-code-verifier")) jar.delete(name)
    await expect(exchange(0)).rejects.toThrow(recoveryError)
    expect(tokenCalls).toBe(0)
    expect((await exchange(1)) === "synthetic-user").toBe(true)
  })
})
