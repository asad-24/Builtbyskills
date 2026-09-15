import "server-only"

import { getOptionalServerEnv } from "@/lib/env"

export async function sendTransactionalEmail(input: { to: string; subject: string; html: string }) {
  const env = getOptionalServerEnv()
  if (!env.brevoApiKey || !env.emailFrom) {
    return { ok: false as const, skipped: true, message: "Email service is not configured.", emailId: null }
  }
  const failure = { ok: false as const, skipped: false, message: "Email delivery could not be confirmed. Please try again later.", emailId: null }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.brevoApiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: env.emailFrom, ...(env.emailFromName ? { name: env.emailFromName } : {}) },
        to: [{ email: input.to }], subject: input.subject, htmlContent: input.html,
      }),
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    })
    if (!response.ok) return failure
    const data: unknown = await response.json()
    if (!data || typeof data !== "object" || !("messageId" in data)
      || typeof data.messageId !== "string" || !data.messageId.trim()) return failure
    return { ok: true as const, emailId: data.messageId }
  } catch {
    // A timeout may occur after provider acceptance. Never retry or expose payloads.
    return failure
  } finally {
    clearTimeout(timeout)
  }
}
