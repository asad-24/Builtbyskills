# Builtbyskills

Next.js learning management system backed by MongoDB Atlas and Better Auth. MongoDB stores accounts, sessions, courses, enrollments, class links, recordings, payment records, audit history, and uploaded files. Course access is enforced on the server. Private large lesson videos continue to use the existing optional Cloudflare R2 integration.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`, fill `MONGODB_URI`, `MONGODB_DB`, `BETTER_AUTH_SECRET` (at least 32 random characters), and the Brevo sender configuration.
3. Run `npm run db:initialize`. This creates indexes and five published courses with curriculum sections, without replacing existing courses.
4. For the initial administrator, create a gitignored `.env.mongodb-admin` containing `LMS_ADMIN_EMAIL` and `LMS_ADMIN_PASSWORD` before initialization. This file is only used by the initialization script, never by the website. Existing administrator credentials are preserved. Remove the file after setup if you do not need it.
5. Start development with `npm run dev`. Sign in at `/login`; new students register at `/register`, confirm their email, then sign in. Administrators approve enrollment; students only see approved courses. Teachers see assigned courses and can publish links and recordings.

## Vercel

Import the current `.env.vercel` into Vercel Production, remove old `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_*` variables, and redeploy this updated code. Changing environment variables without deploying the MongoDB implementation will leave the old deployment using Supabase. `NEXT_PUBLIC_SITE_URL` must match the exact live HTTPS origin. Keep `BETTER_AUTH_SECRET` stable; it signs authentication cookies and private file links. MongoDB and authentication keys are server-only.

The Atlas database user must have read/write access to the selected database. Atlas Network Access must allow the deployment's outbound connections (use your hosting provider's supported egress configuration). Brevo must have a verified sender and a valid API key for confirmation/reset emails. Admin-created accounts receive password setup links. Authentication sessions are stored in MongoDB, with HttpOnly cookies, password hashing, email verification, rate limiting, and revocation on password reset. Account roles are stored in the private profile collection, never accepted from registration input.

Existing Supabase accounts, passwords, enrollments, and uploaded files are not automatically imported into MongoDB. Historical SQL and the old deployment guide are retained under `supabase/` and `docs/supabase-legacy-setup.md` as reference. Do not run those SQL migrations for the MongoDB deployment.

## Verification

- `npm run typecheck`
- `npm run test:run`
- `npm run test:mongodb` — real Atlas operations in a disposable test database
- `npm run test:lms:e2e` — real browser/server actions with disposable MongoDB fixtures
- `npm run build`

File uploads use server-issued, expiring grants and 1 MB chunks to stay within serverless request limits. Course thumbnails are public; payment screenshots and lesson resources require signed, expiring URLs after authorization. Large MP4 videos continue to use multipart R2 uploads.
