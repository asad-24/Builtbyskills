import "server-only"
import { headers, cookies } from "next/headers"
import { getAuth } from "./auth"
import { DatabaseClient } from "./client"

const requestClients = new WeakMap<object, DatabaseClient>()
export async function createDatabaseServerClient(_options: { passwordRecovery?: boolean } = {}) {
  void _options
  const requestHeaders = await headers()
  const existing = requestClients.get(requestHeaders)
  if (existing) return existing
  const auth = getAuth()
  const currentHeaders = async () => {
    // Server actions may have just set the login cookie. The original request
    // headers are immutable; read the current cookie store for this invocation.
    const current = new Headers(requestHeaders)
    current.set("cookie", (await cookies()).getAll().map(cookie => `${cookie.name}=${cookie.value}`).join("; "))
    return current
  }
  let identityCache: { cookie: string; value: Promise<Awaited<ReturnType<typeof auth.api.getSession>>> } | undefined
  const identity = async () => {
    const current = await currentHeaders(), cookie = current.get("cookie") || ""
    if (!identityCache || identityCache.cookie !== cookie) identityCache = { cookie, value: auth.api.getSession({ headers: current }) }
    const session = await identityCache.value
    return session?.user ?? null
  }
  const client = new DatabaseClient({ service: false, identity })
  client.auth = {
    ...client.auth,
    getUser: async () => { try { const user = await identity(); return { data: { user }, error: null } } catch { return { data: { user: null }, error: { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again shortly." } } } },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try { await auth.api.signInEmail({ headers: requestHeaders, body: { email, password } }); return { error: null } }
      catch (error) { const code = (error as { body?: { code?: string } }).body?.code; return { error: { code: code || "AUTH_UNAVAILABLE", message: code === "INVALID_EMAIL_OR_PASSWORD" ? "Invalid email or password." : code === "EMAIL_NOT_VERIFIED" ? "Confirm your email before signing in." : "Sign-in is temporarily unavailable. Please try again shortly." } } }
    },
    signOut: async () => { await auth.api.signOut({ headers: await currentHeaders() }); return { error: null } },
    signUp: async (input: { email: string; password: string; options?: { data?: Record<string, string>; emailRedirectTo?: string } }) => {
      try {
        const result = await auth.api.signUpEmail({ headers: requestHeaders, body: { email: input.email, password: input.password, name: input.options?.data?.full_name || input.email, phone: input.options?.data?.phone, callbackURL: "/login?confirmed=1" } })
        return { data: { user: result.user, session: null }, error: null }
      } catch { return { data: { user: null, session: null }, error: { code: "SIGNUP_FAILED", message: "Unable to register. Please try again or use Forgot password." } } }
    },
    resetPasswordForEmail: async (email: string, _options?: { redirectTo?: string }) => {
      void _options
      try { await auth.api.requestPasswordReset({ headers: requestHeaders, body: { email, redirectTo: "/reset-password" } }); return { error: null } }
      catch { return { error: { code: "EMAIL_FAILED", message: "Unable to send a reset link. Please try again." } } }
    },
  }
  requestClients.set(requestHeaders, client)
  return client
}
