# Course portals and access control

This extends the existing Supabase Auth/PostgreSQL LMS. Existing R2 video authoring, lesson playback, payment approval, password recovery, public pages, and enrollment history remain in use.

## Where to use the features

- `/admin/courses`: manage the five existing courses and open **Classes & recordings** for each course.
- `/admin/instructors`: create instructor accounts, edit their status, and assign/remove individual courses. Multiple instructors can be assigned to a course.
- Core admin record lists include pagination; assignment controls also load older student/teacher accounts.
- `/admin/enrollments`: enroll an existing student, approve pending access, suspend access, reject/cancel access, or set start/expiry dates. Rejection uses the existing `cancelled` enrollment status; payment review remains in `/admin/payments`.
- `/instructor/courses`: cards for courses actually assigned to the signed-in teacher. Each opens its dedicated `/instructor/courses/[courseId]` workspace.
- Teacher workspaces: create/update live classes, meeting URLs, titles, descriptions, dates, and status; create/update recorded lecture URLs and publish or withdraw them as drafts. Class times are entered and displayed in Pakistan time.
- `/register`: student-only registration, email confirmation, and password login. A confirmed account is initialized through `ensure_student_profile`; no enrollment is granted during registration. Existing admin-created/approved-payment accounts continue to use their activation/reset flow.
- `/student`: eligible live classes and published recording links appear after refresh.
- `/student/courses/[courseId]`: live classes, recording links, and existing published lessons for one approved course.

## Database deployment

The live application uses the existing Supabase project for every role. The gitignored `.env.vercel` is the consolidated deployment configuration for that project; it includes the existing public/server keys and live site URL. No new Supabase project or replacement API keys are required. The optional isolated test project described below is separate from application deployment and is not a prerequisite for using the existing database.

Apply `supabase/migrations/202610240001_course_portals.sql` **before deploying these application changes** to an existing LMS database that has all earlier migrations. An empty Supabase project needs the complete ordered migration chain.

The existing project's Data API/Auth credentials have been checked successfully, its five courses are present, and an active administrator profile exists. The `course_recordings` table and new portal RPCs are currently absent from its API schema, so the migration remains pending. Apply it with the existing project's SQL Editor, a connected Supabase integration, or its database connection. The SQL Editor deployment file `supabase/deploy/course-portals-existing.sql` wraps the migration in an explicit transaction; run the complete file once. Runtime API keys alone do not provide SQL migration access. Preserve the existing records and do not run the development seed.

The migration adds:

- `course_recordings` with RLS, publication visibility, timestamps, and author/course identity protection.
- Dedicated live-class read/write policies: only active enrolled students of a published course can read scheduled/live sessions. Completed/cancelled meetings are hidden from students.
- An atomic administrator-only instructor assignment/revocation RPC, plus synchronization of existing primary instructor assignments.
- Student-only enrollment participant validation and date-window validation.
- An authenticated, verified-email-only student profile initialization RPC. User metadata cannot choose a privileged role. Unclaimed legacy student profiles may be linked only after matching verified email ownership; privileged, inactive, or ambiguous profile identities are rejected.

Teacher writes use the signed-in Supabase client, with explicit assignment checks and RLS. Student link endpoints recheck the current role, enrollment status, start/expiry dates, and course publication before redirecting; responses are private/no-store. Links are not authorized based on client-supplied course names or UI visibility. Updates include a version check to avoid silently overwriting newer changes.

Links point to external meeting/recording providers as requested. A provider URL already opened by an authorized student can be copied outside the LMS; the provider controls access after that point. Use the existing private R2 lesson workflow when restricted video playback is required.

## Auth configuration

Set the academy's production URL in `NEXT_PUBLIC_SITE_URL` and in Supabase Auth's Site URL/allowed redirects. Allow `/auth/confirm` for signup confirmations and preserve `/auth/callback` and `/reset-password` for existing activation/recovery flows. Standard PKCE confirmation codes are supported. For token-hash email templates, point the signup link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`.

Registration uses Supabase Auth's normal email verification/rate limits. Signup creates only a student profile after verification; course approval remains an administrator/payment-review operation. Never hard-code a privileged account or use supplied app-login credentials as database connection credentials.

Reference: [Supabase Next.js user management](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Verification

```sh
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:lms:db
```

`test:lms:db` requires local PostgreSQL tools (`initdb`, `pg_ctl`, `psql`). It creates a NEW disposable cluster, applies every migration, and tests real RLS with separate student/teacher/admin database roles and JWT identities. It never reads environment files or connects remotely. It stops and removes its cluster afterward. Auth schema scaffolding is only for this database-level test; it does not claim to test a live Supabase Auth service.

For the optional automated fixture-based end-to-end suite, use a **separate disposable Supabase project**. This is the test harness's isolation rule, not a requirement for the live app. The requested deployment continues to use the existing database; live acceptance checks use that same deployment and database.

1. Copy `docs/lms-test.env.example` to `.env.lms-test` and configure its API URL, publishable key, server-only secret key, and database connection string. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` also work; the newer key names take precedence. Get API keys from the test project's **Settings → API Keys**, and the database connection from **Connect → Direct connection** (or Session pooler). Never use the `.env.local` project. Keep secrets out of version control and chat. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
2. Configure test Auth's Site URL/allowed redirects for `http://127.0.0.1:3100/auth/confirm`. Use a working test email sender or disable email confirmation in this disposable test project. If CAPTCHA is enabled, configure a testing-compatible setup.
3. Run `npm run test:lms:migrate`. This refuses the `.env.local` project and requires the database host/user to identify the same test project as the API URL. Existing schemas must have correct Supabase migration history.
4. Run `npx playwright install chromium`, then `npm run test:lms:e2e`.

The Playwright suite registers a real student, logs in all three roles, assigns all five courses to a teacher through admin UI, publishes classes/recordings, exercises pending/approved/rejected enrollment, checks direct unauthorized URLs and Supabase REST reads, verifies teacher edits on a new student request, and tests assignment revocation. It generates unique test credentials and removes its own fixtures. Screenshots, videos, and traces are disabled to keep passwords and session material out of artifacts. The test server uses port 3100 and a separate build directory.

## Verification performed in this change

- Full application unit/integration suite and isolated PostgreSQL migration/RLS checks have been run locally.
- Production build, TypeScript, and lint checks have been run. Existing unrelated lint warnings remain.
- Browser checks cover mobile registration layout and anonymous dashboard/API rejection.
- The live Supabase/Playwright lifecycle remains pending until a separate test project's connection configuration is available. App login email/password alone does not provide database/project credentials. No live schema or production user has been modified by this work.
