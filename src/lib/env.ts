import "server-only"
import { MissingEnvironmentError } from "@/lib/errors"

export function getPublicEnv() { return { siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000" } }
export function getDatabaseEnv() {
  const missing = ["MONGODB_URI", "BETTER_AUTH_SECRET"].filter(key => !process.env[key])
  if (missing.length) throw new MissingEnvironmentError(missing)
  return { ...getPublicEnv(), mongodbUri: process.env.MONGODB_URI!, mongodbDb: process.env.MONGODB_DB || "builtbyskills", authSecret: process.env.BETTER_AUTH_SECRET! }
}
export function getServerEnv() {
  const db = getDatabaseEnv()
  const missing = ["BREVO_API_KEY", "EMAIL_FROM"].filter(key => !process.env[key])
  if (missing.length) throw new MissingEnvironmentError(missing)
  return { ...db, brevoApiKey: process.env.BREVO_API_KEY!, emailFrom: process.env.EMAIL_FROM!, emailFromName: process.env.EMAIL_FROM_NAME }
}
export function getOptionalServerEnv() {
  return { ...getPublicEnv(), mongodbUri: process.env.MONGODB_URI, mongodbDb: process.env.MONGODB_DB || "builtbyskills", brevoApiKey: process.env.BREVO_API_KEY, emailFrom: process.env.EMAIL_FROM, emailFromName: process.env.EMAIL_FROM_NAME, sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN }
}
