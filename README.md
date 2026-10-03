# Builtbyskills

Builtbyskills is a Next.js App Router academy and LMS for practical digital skills training. The existing landing page is preserved at `/`; admin, instructor, student, course catalog, enrollment, auth, and policy routes are built around it.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript strict mode
- Tailwind CSS 4 and shadcn/ui
- Supabase PostgreSQL, Auth, RLS, and Storage
- Private Cloudflare R2 lesson videos with server-authorized presigned playback
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

## Lesson Videos (Private R2)

1. Review and apply the prerequisite LMS/YouTube security migrations, then `supabase/migrations/202610030001_private_r2_lesson_videos.sql` and the forward migration `supabase/migrations/202610030002_admin_verified_r2_video_ready.sql`. Preserve historical migrations; do not edit an already-applied migration.
2. Configure the private `builtbyskills-course-videos` R2 bucket and server-only `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, and `R2_BUCKET_NAME`. Keep public access disabled and configure exact-origin CORS as described in [Private R2 course videos](docs/private-r2-videos.md).
3. In Course Builder, create a Video lesson as Draft, then select a browser-compatible MP4 up to **1,000,000,000 bytes (decimal 1 GB)**. The existing private multipart upload flow sends the video to R2.
4. The server verifies the completed object's binding, size, content type, ETag, and metadata. A verified upload can become Ready without FFmpeg, ffprobe, deep codec inspection, or an external media-validation worker. Ready confirms object verification, not browser compatibility.
5. Preview the Ready private video to check picture, sound, and seeking. Explicitly save the Ready video attachment, then publish the lesson. Preview does not save student progress; an upload does not automatically publish a lesson.

Student playback checks authentication, publication, and active exact-course enrollment on the server before redirecting to a short-lived R2 presigned GET URL. Each URL lasts at most **five minutes**, capped by enrollment expiry. This is temporary playback access: course access duration is controlled by enrollment dates. An authorized student whose enrollment remains active can use Retry video to obtain fresh access while retaining the saved resume position. R2 serves the video and byte ranges directly; no Cloudflare Worker or external playback gateway is required, and the bucket remains private.

Playback preserves seeking, progress, resume, explicit/ended completion, and a moving personalized watermark with reduced-motion support. Casual download deterrence includes `nodownload`, Picture-in-Picture restrictions where supported, player context-menu blocking, drag prevention, and player-scoped Ctrl+S/Cmd+S blocking. These controls are not DRM and cannot guarantee download or screen-recording prevention.

Existing legacy YouTube lessons remain compatible during rollout; their unlisted links remain shareable outside the LMS. Historical Mux schema and migrations remain for compatibility/history. Neither YouTube nor Mux is the active workflow for authoring new paid lesson videos.

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
