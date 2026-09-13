import "@testing-library/jest-dom/vitest"

process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
process.env.RESEND_API_KEY = "test-resend-key"
process.env.EMAIL_FROM = "test@example.com"
