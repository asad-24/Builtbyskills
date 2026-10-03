import "server-only"

import { getOptionalServerEnv } from "@/lib/env"

const descriptions = {
  missing_config: "Email configuration is missing.",
  http_error: "Email provider rejected the request.",
  timeout: "Email request timed out; delivery is unconfirmed.",
  network_error: "Email request failed before a usable response.",
  invalid_response: "Email provider returned an invalid success response.",
} as const

function diagnose(category: keyof typeof descriptions, status?: number, code?: unknown) {
  if (process.env.NODE_ENV !== "development") return
  const allowedCodes = ["invalid_parameter", "missing_parameter", "unauthorized", "permission_denied", "not_enough_credits", "duplicate_parameter", "method_not_allowed", "out_of_range"]
  console.warn("[brevo-email]", {
    category,
    ...(status !== undefined ? { status } : {}),
    ...(typeof code === "string" && allowedCodes.includes(code) ? { code } : {}),
    description: descriptions[category],
  })
}

export async function sendTransactionalEmail(input: { to: string; subject: string; html: string }) {
  const env = getOptionalServerEnv()
  if (!env.brevoApiKey || !env.emailFrom) {
    diagnose("missing_config")
    return { ok: false as const, skipped: true, message: "Email service is not configured.", emailId: null }
  }
  const failure = { ok: false as const, skipped: false, message: "Email delivery could not be confirmed. Please try again later.", emailId: null }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let receivedResponse = false
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
    receivedResponse = true
    if (!response.ok) {
      // Only development consumes error JSON; never log arbitrary provider text.
      if (process.env.NODE_ENV === "development") {
        let code: unknown
        try {
          const body: unknown = await response.json()
          if (body && typeof body === "object" && "code" in body) code = body.code
        } catch { /* Retain HTTP status even when the error body is unreadable. */ }
        diagnose("http_error", response.status, code)
      }
      return failure
    }
    const data: unknown = await response.json()
    if (!data || typeof data !== "object" || !("messageId" in data)
      || typeof data.messageId !== "string" || !data.messageId.trim()) {
      diagnose("invalid_response")
      return failure
    }
    return { ok: true as const, emailId: data.messageId }
  } catch {
    diagnose(controller.signal.aborted ? "timeout" : receivedResponse ? "invalid_response" : "network_error")
    // A timeout may occur after provider acceptance. Never retry or expose payloads.
    return failure
  } finally {
    clearTimeout(timeout)
  }
}
