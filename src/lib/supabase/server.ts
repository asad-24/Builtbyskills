import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { getPublicEnv } from "@/lib/env"

export async function createSupabaseServerClient() {
  const env = getPublicEnv()
  const cookieStore = await cookies()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot mutate cookies; Server Actions and Route
          // Handlers can. Supabase SSR recommends tolerating this path.
        }
      },
    },
  })
}
