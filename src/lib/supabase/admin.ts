import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getSupabaseAdminEnv } from "@/lib/env"

export function createSupabaseAdminClient() {
  const env = getSupabaseAdminEnv()

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
