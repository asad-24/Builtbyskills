"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createSupabaseBrowserClient(manualRecovery = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("Supabase browser environment variables are missing.")
  }

  return createBrowserClient(url, anonKey, manualRecovery ? {
    // Recovery pages explicitly exchange URL credentials once and handle errors.
    isSingleton: false,
    auth: { detectSessionInUrl: false },
  } : undefined)
}
