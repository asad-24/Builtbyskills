import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { sendTransactionalEmail } from "@/lib/email/send"

const input = { to: "student@example.com", subject: "Activation", html: '<a href="https://auth.example/secret-link">Set password</a>' }
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", "private-api-key")
  vi.stubEnv("EMAIL_FROM", "sender@example.com")
  vi.stubEnv("EMAIL_FROM_NAME", "")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
describe("Brevo transactional sender", () => {
  it.each(["BREVO_API_KEY", "EMAIL_FROM"])("skips when %s is missing", async (key) => {
    vi.stubEnv(key, "")
    expect(await sendTransactionalEmail(input)).toMatchObject({ ok: false, skipped: true, emailId: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each(["", "Builtbyskills"])("maps request and optional sender name %s", async (name) => {
    vi.stubEnv("EMAIL_FROM_NAME", name)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: "<accepted-id>" }), { status: 201 }))
    expect(await sendTransactionalEmail(input)).toEqual({ ok: true, emailId: "<accepted-id>" })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.brevo.com/v3/smtp/email")
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error",
      headers: { "api-key": "private-api-key", "Content-Type": "application/json", Accept: "application/json" } })
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(options.body)).toEqual({ sender: { email: "sender@example.com", ...(name ? { name } : {}) },
      to: [{ email: input.to }], subject: input.subject, htmlContent: input.html })
  })
  it.each([400, 401, 429, 500])("safely rejects HTTP %s without retry", async (status) => {
    fetchMock.mockResolvedValue(new Response("private-api-key secret-link provider details", { status }))
    const result = await sendTransactionalEmail(input)
    expect(result).toMatchObject({ ok: false, skipped: false, emailId: null })
    expect(JSON.stringify(result)).not.toMatch(/private-api-key|secret-link|provider details/)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it.each(["not-json", "null", "{}", '{"messageId":42}', '{"messageId":" "}'])("rejects malformed success %s", async (body) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 201 }))
    expect(await sendTransactionalEmail(input)).toMatchObject({ ok: false, skipped: false })
  })
  it("contains network errors without leaking credentials or links", async () => {
    fetchMock.mockRejectedValue(new Error("private-api-key secret-link"))
    const result = await sendTransactionalEmail(input)
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/private-api-key|secret-link/)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it("aborts after ten seconds and never retries", async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("private timeout details")))
    }))
    const pending = sendTransactionalEmail(input)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toMatchObject({ ok: false, skipped: false })
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
