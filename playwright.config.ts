import { defineConfig, devices } from "@playwright/test"
import { loadTestEnvironment } from "./scripts/lms-test-env.mjs"
const env = loadTestEnvironment()
process.env.LMS_E2E_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
process.env.LMS_E2E_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
process.env.LMS_E2E_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:3100", trace: "off", screenshot: "off", video: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm run dev -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/login", env, reuseExistingServer: false, timeout: 120_000 },
})
