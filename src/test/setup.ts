import "@testing-library/jest-dom/vitest"

process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
process.env.BREVO_API_KEY = "test-brevo-key"
process.env.EMAIL_FROM = "test@example.com"
process.env.EMAIL_FROM_NAME = "Builtbyskills"
