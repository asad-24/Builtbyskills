# Builtbyskills

Builtbyskills is a Next.js App Router academy and LMS for practical digital skills training. The existing landing page is preserved at `/`; admin, instructor, student, course catalog, enrollment, auth, and policy routes are built around it.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript strict mode
- Tailwind CSS 4 and shadcn/ui
- Supabase PostgreSQL, Auth, RLS, and Storage
- Mux direct uploads and signed playback
- Brevo API transactional email helpers
- Vercel Analytics and Sentry-ready error boundaries

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_SIGNING_KEY_ID`
- `MUX_SIGNING_PRIVATE_KEY`
- `BREVO_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME` (optional)
- `NEXT_PUBLIC_SENTRY_DSN`

Never commit real secrets.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/202609090001_builtbyskills_lms_core.sql`.
3. Run `supabase/seed.sql` for development data.
4. Confirm these buckets exist:
   - `course-thumbnails` public, image-only
   - `payment-screenshots` private
   - `lesson-resources` private
5. Create the first Super Admin manually in Supabase Auth.
6. Link that auth user to a `profiles` row with `role = 'super_admin'`, `status = 'active'`, and `auth_user_id` set to the Auth user ID.

Seed files intentionally do not contain production passwords.

## Mux Setup

1. Create a Mux access token.
2. Create a Mux signing key.
3. Add token ID, token secret, signing key ID, and signing private key to Vercel and `.env.local`.
4. Admin video upload URLs are generated through `/api/mux/direct-upload`.
5. Student playback tokens are generated through `/api/mux/playback-token` only after server-side enrollment checks.

## Vercel Deployment

1. Add all environment variables in Vercel Project Settings.
2. Deploy from the repository.
3. Run Supabase migrations before opening admin routes.
4. Verify `NEXT_PUBLIC_SITE_URL` matches the production domain.

## Admin Account Creation

Create the first administrator in Supabase Auth, then insert or update the matching profile:

```sql
update public.profiles
set auth_user_id = 'AUTH_USER_UUID', role = 'super_admin', status = 'active'
where email = 'admin@example.com';
```

Use the real admin email in production.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

## Optional Improvements

- Add drag-and-drop lesson ordering after structured CRUD is stable.
- Add richer Website Content editing tables for homepage copy.
- Add scheduled live-class reminder jobs.
- Add Sentry project initialization files once the production Sentry project exists.

Custom application email uses the Brevo transactional API with server-only `BREVO_API_KEY` and a verified sender email in `EMAIL_FROM`. Optional `EMAIL_FROM_NAME` sets the display name. Use an API key, not the SMTP key configured in Supabase. Supabase Auth Forgot Password continues to use its existing custom SMTP configuration.
