import "server-only"

import { MissingEnvironmentError } from "@/lib/errors"

const publicKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const

const emailKeys = [
  "BREVO_API_KEY",
  "EMAIL_FROM",
] as const

export function getPublicEnv() {
  const env = {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const missing: string[] = publicKeys.filter((key) => !process.env[key])
  if (!env.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)")
  if (missing.length > 0) {
    throw new MissingEnvironmentError(missing)
  }

  return env as typeof env & {
    supabaseUrl: string
    supabaseAnonKey: string
  }
}

export function getServerEnv() {
  const publicEnv = getSupabaseAdminEnv()
  const env = {
    ...publicEnv,
    brevoApiKey: process.env.BREVO_API_KEY,
    emailFrom: process.env.EMAIL_FROM,
    emailFromName: process.env.EMAIL_FROM_NAME,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  }

  const missing = emailKeys.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new MissingEnvironmentError(missing)
  }

  return env as typeof env & {
    supabaseServiceRoleKey: string
    brevoApiKey: string
    emailFrom: string
    emailFromName: string
  }
}

export function getSupabaseAdminEnv() {
  const publicEnv = getPublicEnv()
  const env = {
    ...publicEnv,
    supabaseServiceRoleKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  if (!env.supabaseServiceRoleKey) {
    throw new MissingEnvironmentError(["SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)"])
  }

  return env as typeof env & { supabaseServiceRoleKey: string }
}

export function getOptionalServerEnv() {
  return {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    brevoApiKey: process.env.BREVO_API_KEY,
    emailFrom: process.env.EMAIL_FROM,
    emailFromName: process.env.EMAIL_FROM_NAME,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  }
}
