# YouTube-only lesson video replacement

## Implemented behavior

1. **Admin:** Create/Edit Lesson → Video → paste a normal YouTube link → save Draft → deliberately select Published and save. The default remains Draft. The link is editable, and Remove video link clears it and selects Draft if previously Published. Server publication validation rejects a missing/invalid reference. Clearing the field manually also requires Draft or Archived. PDF/file and External lessons keep their existing attachment readiness checks.
2. **Student:** Existing My Courses/Dashboard discovery and ordered Published curriculum links lead to the protected lesson page. Video uses the official embedded YouTube IFrame Player API, with inline mobile playback and responsive sizing. No LMS raw-video URL, Copy link, Open on YouTube, or Share control is added. Text, private downloads, External resources, and Live Class rendering stay separate.
3. **Storage:** One nullable `lessons.youtube_video_id` column stores the canonical 11-character ID. Server parsing accepts recognized watch, short-link, embed, Shorts, and live URL forms, discards tracking/start/playlist parameters, and rejects arbitrary HTML, credentials, unsupported hosts, ports, and malformed IDs. Admin editing reconstructs `https://www.youtube.com/watch?v=ID`. Submitted raw IDs cannot substitute for URL validation. Syntax validation proves neither Unlisted privacy, availability, nor embedding permission.
4. **Mux removed:** Upload UI, direct-upload/status endpoint, processing polling, playback-token endpoint, signing/upload server utilities, Mux Player component, environment requirements, configuration UI entry, dependency, mocks, and exclusive tests. No active fallback provider remains.
5. **Mux retained:** Historical database fields, historical migrations, legacy type metadata, and compatibility tests. The previous implementation report is marked historical. No Mux assets or stored identifiers were deleted; replacement updates do not write those columns.
6. **Legacy:** A video without a valid YouTube reference shows “The video is not available yet. Please check back later.” rather than using Mux or crashing. Admin gets a replacement-link notice for legacy metadata and can convert the lesson without changing its ID, resources, enrollment, position, slug, or progress records. A read-only query of the database configured in the repository's `.env.local` found **0 lessons** containing any Mux upload, asset, or playback metadata. Other environments were not inspected.
7. **Migration:** `supabase/migrations/202610020001_youtube_lesson_video.sql`. Additive nullable column and ID-format CHECK only. No backfill, old-column deletion, publication changes, or RLS changes. Created for manual review; **not applied**. Existing migrations, including pre-existing uncommitted migrations, were not edited.
8. **Credentials/dependencies:** `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, and `MUX_SIGNING_PRIVATE_KEY` are no longer read or required. `.env.local` and hosted configuration were not edited. `@mux/mux-player-react` and 14 exclusively Mux-related lockfile entries were removed; retained dependency entries were verified unchanged. No new package, YouTube API key, or OAuth connection is required.
9. **Watermark:** A subtle name-based personal-learning label sits in the video container's top band, outside the iframe. Email fallback exposes only the first two characters of the local part. No internal IDs or secrets appear. Alignment changes every 30 seconds; reduced-motion preference keeps it static, including preference changes while mounted. This differs from an overlay directly over the video: YouTube's supported rules prohibit obscuring its embedded player. It is visible during inline playback, but is absent in the iframe's own fullscreen/Picture-in-Picture view and can be excluded from a recording.
10. **Progress:** The same `lesson_progress` records and `/api/student/progress` endpoint are used. Resume uses saved seconds; playing is sampled every five seconds and saved after at least 15 seconds of position change. Pause, hidden-page, and page-exit events request a save. Ended and explicit Mark lesson complete request completion; loading alone never completes a lesson. Duration comes from the player for percentage calculation and is bounded/validated without changing lesson metadata. Writes are serialized in the client, existing completion is retained by the endpoint, failures offer retry, and unmount cleans up player/timers. Progress remains client-reported, not a watch-attestation/security mechanism.

## Authorization and compatibility

The existing `requireStudentLesson` guard is unchanged: authenticated active Student, Published lesson, exact-course enrollment, active status, absent or inclusive `starts_at`, and absent or exclusive `expires_at`. The guard remains in both the page data loader and progress endpoint. Private-resource authorization and signing are unchanged. No RLS or schema security rules were weakened. Enrollment cannot protect the underlying Unlisted link after a viewer obtains it.

No new next-lesson unlocking system is introduced. Existing ordered Published curriculum navigation, My Courses, and Dashboard discovery remain intact.

## Files added

- `src/lib/lessons/youtube.ts`
- `src/lib/lessons/youtube-player-api.ts`
- `src/components/student/youtube-lesson-player.tsx`
- `src/components/student/video-watermark.tsx`
- `supabase/migrations/202610020001_youtube_lesson_video.sql`
- `src/__tests__/unit/lib/youtube.test.ts`
- `src/__tests__/unit/lib/youtube-player-api.test.ts`
- `src/__tests__/unit/components/student/youtube-lesson-player.test.tsx`
- `src/__tests__/integration/actions/youtube-lessons.test.ts`
- `docs/youtube-video-replacement.md`

## Files updated by this task

- `README.md`, `package.json`, `package-lock.json`
- `src/actions/admin.ts`
- `src/app/admin/course-builder/[courseId]/page.tsx`
- `src/app/admin/general-settings/page.tsx`
- `src/app/student/lessons/[lessonId]/page.tsx`
- `src/app/api/student/progress/route.ts`
- `src/components/admin/lesson-editor.tsx`
- `src/lib/env.ts`, `src/lib/validations/lms.ts`, `src/types/lms.ts`
- `src/__tests__/integration/actions/course-builder.test.ts`
- `src/__tests__/integration/api/student/lesson-access.test.ts`
- `src/__tests__/integration/components/course-builder-content.test.tsx`
- `src/__tests__/integration/components/student-lesson-content.test.tsx`
- `src/__tests__/unit/components/admin/lesson-authoring.test.tsx`
- `docs/course-builder-implementation-2026-10-01.md` (historical notice only)

Some updated files already contained uncommitted work; the existing implementation was edited in place without restoring/resetting it. Unrelated work was preserved.

## Files deleted

- `src/components/admin/lesson-video-upload.tsx`
- `src/components/student/mux-lesson-player.tsx`
- `src/lib/mux/server.ts`
- `src/app/api/mux/direct-upload/route.ts`
- `src/app/api/mux/playback-token/route.ts`
- `src/test/mocks/mux.tsx`
- `src/__tests__/unit/components/student/mux-lesson-player.test.tsx`
- `src/__tests__/unit/lib/mux-upload.test.ts`
- `src/__tests__/integration/api/mux/course-video-upload.test.ts`

## Verification

- Complete Vitest suite: **54 files, 626 tests passed**.
- After the final React callback/lint correction: **12 player/watermark tests passed** again.
- TypeScript: passed after regenerating Next route types to remove stale references to deleted routes.
- Targeted ESLint covering changed application and test files: passed, no warnings/errors.
- `git diff --check`: passed.
- Dependency lock review: retained package entries unchanged; only the root Mux dependency and exclusively Mux-related entries removed.
- Existing Text/PDF/External/Live Class, active enrollment/date boundary, private resources, dashboard/My Courses discovery, course authoring, and payment regressions are covered by the complete suite.
- No migration execution or live YouTube playback/browser smoke test was performed. Tests simulate the documented IFrame API; they do not verify an actual video's privacy/availability or every mobile browser.

## YouTube limitations and documentation

Unlisted links can be copied from the browser/player and shared outside the LMS. The official player retains YouTube branding, controls, and platform links; no unsupported attempt is made to conceal/remove them. `rel=0` restricts related videos to the same channel rather than disabling them. Missing/private/deleted/embedding-disabled videos get a friendly playback failure. Browser blockers, connectivity, regional restrictions, and Google platform changes can affect playback. The watermark is a reminder, not DRM or recording prevention.

- [Official IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [Supported player parameters](https://developers.google.com/youtube/player_parameters)
- [Embedded-player requirements, including the prohibition on obscuring the player](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [YouTube visibility settings](https://support.google.com/youtube/answer/157177?hl=en)

## Manual next steps

1. Review and apply **only** `202610020001_youtube_lesson_video.sql` to the intended database before using the new editor. Ensure existing LMS security migrations/policies are already present; this migration does not replace them.
2. Run `npm install` to synchronize local installed packages with the updated manifest/lockfile, then restart the local app when ready to review it.
3. Upload an owned training video to the agency YouTube channel. Set visibility to Unlisted and permit embedding; wait for processing.
4. Create/Edit a Draft Video lesson, paste its link, and save. Explicitly select Published and save when ready. Nothing auto-publishes.
5. Verify with an actively enrolled Student: inline playback, resume, progress, manual completion, ordered curriculum navigation, mobile layout, and the personal watermark. Test an unavailable/embedding-disabled video and a denied enrollment as well.
6. For any legacy videos found in another environment, recover the original videos, upload them to YouTube, and attach replacement links to the existing lesson rows. This implementation does not export Mux assets or delete them.
7. Mux environment values may be removed manually after review; they are unused. No hosting settings, asset deletion, deployment, commit, or push was performed by this task.
