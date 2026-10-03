# Private R2 course videos

New paid lesson videos use private Cloudflare R2. Authorized admins upload MP4s
through Course Builder and reach Ready after trusted server object verification,
without FFmpeg, ffprobe, deep codec inspection, or an external media-validation
worker. Ready videos can be previewed before publishing.

Student playback uses server-authorized short-lived R2 presigned GET URLs;
R2 serves video bytes and ranges directly. No Cloudflare Worker or external
authenticated playback gateway is required. URL access lasts at most five
minutes, capped by enrollment expiry; course access duration is controlled by
enrollment dates. Apply the forward migration below before running the updated
completion code. Existing legacy YouTube compatibility remains during rollout;
historical Mux schema/migrations remain for compatibility/history, not new video
authoring.

## Repository implementation

- Private R2 bucket: `builtbyskills-course-videos`, region `auto`.
- Server-only config reads the four existing R2 variables. No environment file
  is modified. Authentication, resources and payments do not require R2 config.
- Source limit: **1,000,000,000 bytes** (decimal 1 GB). 16 MiB multipart chunks,
  at most three concurrent browser uploads, three retries per part. Uploads
  expire after 24 hours; part URLs last at most ten minutes.
- Active super-admin and exact same-origin POST checks protect upload controls.
  Upload records precede permissions. UUID keys are generated on the server;
  browser-supplied keys/buckets are rejected. Completion checks actual part
  sizes, object size, MIME, ETag and asset metadata. No video bytes use a Server
  Action. Those checks establish object binding, **not media compatibility**.
- Only the trusted server completion path supplies verified R2 metadata to the
  active-admin, service-role-only finalization RPC. It atomically makes the asset
  Ready and completes the upload session. No browser media claims are accepted.
  Codec, duration, pixel format and fast-start remain unknown unless previously
  measured; no metadata is fabricated.
- Ready attachment/removal, optimistic versions, reference-safe cleanup claims
  and completion stickiness are enforced by database functions/triggers.
- Admin preview authorizes access to a Ready private video before publishing,
  using a short-lived presigned GET redirect. It supports checking picture,
  sound and seeking without saving student progress; access can be refreshed.
- First uploads stay Draft. Replacements keep the old pointer until attachment;
  historical lesson IDs/resources/progress remain intact. Replaced/removed
  objects retire for seven days. Deleted lesson/course assets retain original
  object identity in tombstones. Unattached unfinished uploads expire safely.
- The HTML5 MP4 player requests a short-lived presigned GET redirect from the
  authenticated website media route. It preserves seeking, native accessible
  controls, inline playback and wrapper fullscreen. The personalized watermark
  moves, with reduced-motion support. Native platform fullscreen may exclude
  the wrapper. Casual download deterrence includes `nodownload` and
  Picture-in-Picture restrictions where supported, player context-menu blocking,
  drag prevention and player-scoped Ctrl+S/Cmd+S blocking. These controls are not
  DRM or guaranteed download/screen-recording prevention; an authorized user can
  record or capture delivered video bytes.
- Existing progress cadence/resume/explicit and ended completion are retained.
  R2 percentage uses available duration; replacement does not reset progress.

## Manual migration and rollout

The original migration `202610030001_private_r2_lesson_videos.sql` is already
applied and must remain untouched. The new forward migration is
`supabase/migrations/202610030002_admin_verified_r2_video_ready.sql`.
It replaces only the Ready media-analysis constraint, permits completion claims
for existing validating uploads, accommodates unknown duration using the lesson's
existing zero default, and adds the service-role-only atomic
`finish_lesson_video_upload` RPC. It changes no rows automatically. All changes
run in one transaction; an unexpected constraint layout or invalid existing row
aborts the migration. Reapplying it is supported.

MP4 selection -> existing basic checks (maximum 1 GB) -> private multipart upload
-> server lists/verifies parts and completes R2 -> server HEAD checks immutable
key, asset metadata, size, content type and ETag -> atomic Ready -> admin preview
-> explicit Save ready video -> normal lesson Save/Publish. Failed verification or database
finalization never attaches a replacement or reports Ready.

Opening a lesson with an old validating upload requests completion again. The
server re-verifies its private object, including its previously stored size and
ETag. Missing, changed, expired, retired or cleanup-claimed assets are rejected;
retry or cancel/re-upload is available. There is no bulk promotion of old assets.
The upload session's terminal value remains `validating` for compatibility with
existing attachment and cleanup code; the asset and UI become `ready`.

## Cloudflare dashboard: exact CORS

No verified production origin is recorded in deployment configuration. Obtain
the deployed origin from the project's `NEXT_PUBLIC_SITE_URL`/Vercel domain.
Generate the exact policy with:

```powershell
node scripts/r2-cors.mjs https://YOUR_ACTUAL_PRODUCTION_HOST
```

Paste the resulting JSON into this private bucket's CORS policy. It contains
only that exact HTTPS origin and `http://localhost:3000`, methods `PUT`, `GET`, `HEAD`, allowed
headers `Content-Type` and `Range`, exposed ETag/range/length headers, and 300-second preflight caching.
Content-Length is browser-controlled; the signed part binds its expected size.
No checksum header is used. GET browser access serves presigned playback. Add an additional exact origin only if the app is actually
served there; do not allow wildcards or arbitrary preview domains. CORS does
not grant public access and is not an authorization mechanism.

Keep Public Access disabled, `r2.dev` disabled, and do not attach a public R2
custom domain. Enable a lifecycle rule scoped to `courses/` to abort incomplete
multipart uploads after **one day**. Do not apply an automatic deletion policy
to completed objects: lifecycle rules cannot check database references.

## Media compatibility

There is no external validator requirement for uploads. Ready means the private
object was verified by the trusted server, not that codecs or browser playback
were deeply inspected. Successful server object verification can make an upload
Ready directly; it does not need to wait in Checking for an external validator.
Admins should select browser-compatible MP4 exports and preview them before
publishing. No FFmpeg/ffprobe infrastructure is required for this workflow.

## Short-lived presigned playback

The authenticated lesson route now verifies student, publication, exact active
course enrollment and attached Ready asset, then HEAD-verifies size, MIME and
ETag before a private/no-store 307 redirect to a server-signed GET URL.
URLs last at most five minutes, capped by enrollment expiry. Standard signing
includes the non-secret Access Key ID; the Secret Access Key stays server-only.
No URL or SDK error is logged, persisted or returned in an error response.
R2 serves ranges directly without Vercel streaming. HEAD remains authenticated
and metadata-only. Retry video reloads the website route and rechecks access,
retaining the last saved resume position. Issued URLs are bearer grants until
expiry; revocation prevents new grants but cannot retract delivered bytes or
existing grants. An open transfer may continue after expiry.

The five-minute URL lifetime does not limit the student's course access to five
minutes. Enrollment start/expiry dates control actual course access. When a URL
expires, an authorized student whose enrollment remains active can use Retry
video to request fresh playback access. Renewal rechecks current authorization;
it does not extend enrollment or bypass revoked/expired access. No automatic
background URL renewal is implied. The R2 bucket stays private, and this flow
requires no Cloudflare Worker or external playback gateway.

Regenerate bucket CORS using the script: exact origins, PUT/GET/HEAD,
Content-Type/Range and exposed ETag/range/length headers. Keep public access,
r2.dev and public custom domains disabled. No Cloudflare settings were applied.
Test real R2 playback, seeking after expiry, retry, Safari/iOS and browser codecs
before rollout.

## Cleanup and recovery

`POST /api/admin/lesson-videos/maintenance` is active-super-admin, same-origin
only and processes bounded batches. It first retires expired unreferenced
uploads, then atomically claims eligible assets, aborts leftover multipart state,
deletes R2 objects and persists tombstones. Active completion operations and
referenced videos cannot be claimed; `deleting` assets cannot be attached.
Failures leave retryable claims that expire after five minutes. A deleted object
with a failed tombstone write is safe to delete again on the next run.

Configure a trusted scheduler to invoke the same cleanup service in its chosen
runtime, or run the authenticated maintenance action manually until scheduling
exists. There is no unauthenticated cron endpoint or scheduler secret in this
change. Do not make the admin maintenance route public for a cron service.
Completion retries HEAD the immutable object to recover R2 success followed by
a database failure. Initial multipart creation followed by a lost binding write
is aborted best-effort and otherwise covered by the one-day R2 lifecycle rule.

After a page reload, unfinished part uploads should be canceled and the file
selected again; retry without reuploading completed parts works within the same
selected-file session. Validation/Ready sessions are recovered from the database.
Ready attachment is deliberate and never auto-publishes a lesson.

## Checks before production

Apply the migration in staging; verify RLS/functions and concurrent attachment,
cleanup and cancellation against real PostgreSQL. Exercise a real R2 multipart
upload, cancel/retry, verified readiness, seven-day retirement and object reconciliation.
Test presigned byte ranges and authenticated HEAD with Safari/iOS, Chromium and Firefox, seeking,
resume, revoked access, reduced motion and fullscreen. Mocked SDK/player tests
do not prove Cloudflare CORS, codecs or production domain/session routing.

## Files changed for the upload simplification

- `supabase/migrations/202610030002_admin_verified_r2_video_ready.sql`
- `src/lib/r2/uploads.ts`
- `src/app/api/admin/lesson-videos/route.ts`
- `src/components/admin/lesson-video-upload.tsx`
- `src/__tests__/integration/api/storage/r2-lesson-videos.test.ts`
- `src/__tests__/unit/components/admin/lesson-video-upload.test.tsx`
- `supabase/tests/r2_video_object_ready.sql`
- `supabase/tests/r2_video_security.sql` (correct an existing assertion: retiring
  a referenced asset must fail)
- `supabase/tests/r2_video_scaffold.sql` (match the actual non-null lesson duration)
- `scripts/test-r2-migration.mjs`
- `docs/private-r2-videos.md`

## Verification results for upload simplification

- Full regression suite: **68 files, 823 tests passed**, including Course Builder,
  YouTube legacy compatibility, student progress/resume/completion, authorization,
  payments, enrollment, resources and other lesson types.
- Final upload/recovery tests: **2 files, 43 tests passed**, including two additional
  UI recovery regressions added after the full suite.
- Disposable local PostgreSQL checks: both migrations, repeat forward application,
  pre-existing Ready/failed/validating rows unchanged, zero-default duration,
  Ready attachment/publication, stale replacement, failed replacement, private
  privileges/RLS, reference safety, retirement and cleanup passed.
- TypeScript, targeted ESLint and `git diff --check`: passed.
- Live R2 and hosted Supabase checks were not performed. Local SQL testing uses
  PGlite and a scaffold matching the relevant repository schema; it does not
  test multi-connection production concurrency or independently verify schema drift.
- Original applied migration SHA256 remains
  `21572602E3221F52641D4350D33B954BDDA7608395925FF1B811D0E2686649EA`.
- No production SQL/data, secrets, environment values, Cloudflare settings,
  student player code or unrelated features/design changed. No commit, push
  or deployment occurred. Existing uncommitted work is preserved.

## Presigned playback verification

Full regression run: 68 files, 830 tests passed. Additional final playback
checks: 49 tests passed. TypeScript, targeted ESLint and diff whitespace checks
passed. Synthetic SDK signing verifies Access Key ID visibility and secret
exclusion. Live R2/CORS and browser playback were not exercised. No environment
file, SQL migration, production setting, commit, push or deployment changed.
