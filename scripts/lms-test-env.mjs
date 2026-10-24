import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { resolve } from 'node:path'
/** @returns {Record<string, string>} */
export function loadTestEnvironment() {
  const path = process.env.LMS_TEST_ENV_FILE || resolve('.env.lms-test')
  if (!existsSync(path)) throw new Error('Create .env.lms-test using docs/lms-test.env.example. Live tests require a separate Supabase test project.')
  const env = parseEnv(readFileSync(path, 'utf8'))
  // Normalize both names so the test server cannot inherit keys from .env.local.
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serverKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ''
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY = publicKey
  env.SUPABASE_SECRET_KEY = env.SUPABASE_SERVICE_ROLE_KEY = serverKey
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env[name] || /YOUR_|REPLACE_/.test(env[name])) {
      const label = name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)' : name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)' : name
      throw new Error(`Configure ${label} in the test environment file.`)
    }
  }
  const production = existsSync('.env.local') ? parseEnv(readFileSync('.env.local','utf8')) : {}
  if (new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin === new URL(production.NEXT_PUBLIC_SUPABASE_URL || 'https://unused.invalid').origin) throw new Error('Refusing to run against the existing .env.local Supabase project. Use a separate test project.')
  return { ...env, LMS_E2E: "1", NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100', BREVO_API_KEY: '', EMAIL_FROM: '' }
}
