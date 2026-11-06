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
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)
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

The application now targets **one selected Supabase project, `ajvtvbpqywxxclmdtnkr`**, for admin, teachers, students, courses, and enrollments. The previous `tnnkslgihwofhvigfzef` project's environment configuration is backed up locally in gitignored `.env.local.previous-project` / `.env.vercel.previous-project` files. Changing the active project does not transfer its accounts, enrollments, payment methods, or files.

1. The local, gitignored `.env.local` and `.env.vercel` contain the selected project's URL/public key. Add **that same project's** server-only secret to `SUPABASE_SECRET_KEY` in both files before deploying. The old project's server keys were removed deliberately. `SUPABASE_SERVICE_ROLE_KEY` is an optional compatibility alias and must be empty or belong to this same project. Existing Brevo application-email settings are retained; the production site URL remains `https://builtbyskills.vercel.app`.
2. In the selected project's Supabase SQL Editor, run the complete [new-project initialization file](supabase/deploy/initialize-new-project.sql) once. It applies all 13 ordered migrations atomically, records their versions, grants Data API access through RLS, and adds the five current courses at PKR 10,000 each with 20 curriculum sections. It refuses an existing LMS schema and does not create sample users, enrollments, or payment accounts. Do not run `supabase/seed.sql`, which contains development data. The [single course-portal upgrade file](supabase/deploy/course-portals-existing.sql) is only for an older database that already has the preceding migrations; it cannot initialize this new project.
3. Create the first administrator using the steps below. Add the academy's real payment methods through the admin panel. Previous accounts/enrollments/files must be explicitly restored/imported or recreated; they are not included in the starter catalog.
4. In the selected Supabase project's Auth settings, set the production Site URL and allow `https://builtbyskills.vercel.app/auth/confirm`, `https://builtbyskills.vercel.app/auth/callback`, and `https://builtbyskills.vercel.app/reset-password`. Configure Auth's email/SMTP sender in this new project as well; an application Brevo API key does not configure Supabase Auth SMTP. For a different live domain, update these URLs and `NEXT_PUBLIC_SITE_URL` together.
5. Import the completed `.env.vercel` values into the Vercel project's environment settings and deploy the updated repository. Existing deployments do not acquire changed variables until redeployed. Check registration/login, teacher course assignment, publishing, approved enrollment, and student class/recording access on the resulting deployment. Keep environment files and backups out of Git.

The class/recording link features do not need R2 credentials. Private R2 lesson video uploads/playback additionally need the four server-only R2 variables described above; copy existing Vercel R2 settings if already configured. Database passwords and automated-test variables are not runtime requirements for Vercel.

## Admin Account Creation

In the selected project's **Authentication → Users**, create the first administrator with their real email and password and confirm the email. Copy that new Auth user's UUID, replace `AUTH_USER_UUID` below, and run this in the SQL Editor after initialization:

```sql
insert into public.profiles (auth_user_id, full_name, email, role, status)
select id,
       coalesce(nullif(raw_user_meta_data->>'full_name', ''), 'Builtbyskills Admin'),
       email, 'super_admin', 'active'
from auth.users
where id = 'AUTH_USER_UUID'::uuid
on conflict (auth_user_id) do update
set role = 'super_admin', status = 'active'
returning id, email, role, status;
```

Confirm that the statement returns the intended active administrator, then sign in at `/login`. Existing users in another Supabase project do not automatically have accounts here. Never put the administrator's password in SQL files or source code.

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
