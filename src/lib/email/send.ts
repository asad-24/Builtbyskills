import "server-only"

import { Resend } from "resend"

import { getOptionalServerEnv } from "@/lib/env"

export async function sendTransactionalEmail(input: {
  to: string
  subject: string
  html: string
}) {
  const env = getOptionalServerEnv()

  if (!env.resendApiKey || !env.emailFrom) {
    return { ok: false as const, skipped: true, message: "Resend is not configured." }
  }

  const resend = new Resend(env.resendApiKey)
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to: input.to,
    subject: input.subject,
    html: input.html,
  })

  if (error) {
    return { ok: false as const, skipped: false, message: error.message }
  }

  return { ok: true as const }
}
