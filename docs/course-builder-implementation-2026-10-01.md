> Historical implementation report. The Mux workflow below has been retired by the YouTube-only replacement; see README.md and docs/youtube-video-replacement.md for current behavior. Historical migrations and metadata remain unchanged.

Course Builder implementation report ? October 1, 2026

1. Problems addressed

The previous builder required slugs, positions, durations, and Mux IDs; default lesson positions collided with existing rows. It lacked lesson editing and upload completion. Student pages assumed all content was video; resources had no usable download controls. Privileged loaders, token issuance, and progress writes did not consistently check lesson publication. RLS allowed preview rows regardless of publication and progress writes without checking active enrollment or lesson visibility. Course and upload forms could show raw service errors.

2. Admin workflow

Create a course using its title and business details; the web address is generated unless an optional custom address is supplied. Existing course addresses remain unchanged unless the Admin uses the advanced address control. Add a section, then create a lesson with its title, content type, description or text, and visibility. For video, downloadable files, or external links, save a draft first, open the lesson, attach its content, then publish. Existing lessons and section titles/descriptions can be edited in place. Pending controls prevent repeat submissions and controlled lesson/section inputs preserve failed edits.

3. Content types

Video uses private signed Mux playback. Text uses the existing description field as escaped plain text, preserving paragraphs and line breaks. PDF/resource lessons support the existing PDF, PNG, JPEG, WebP, ZIP, and plain-text MIME list and 25 MB storage limit. External/video links use lesson_resources with an explicit external_link discriminator and a validated URL in file_path; they open an external site, rather than masquerading as signed Mux playback. Live-class lessons provide information and link to the existing course scheduling workflow; no lesson-to-meeting relationship is invented. Common private attachments remain available for every lesson type.

4. Mux upload workflow

An authorized Admin requests an upload for an existing video lesson. The server creates a signed-only direct upload with lesson passthrough, then conditionally stores its upload ID on that lesson. Only the scoped upload URL reaches the browser. The browser uploads the file and shows percentage progress. Status checks read the upload ID from the database, retrieve the corresponding asset through server credentials, verify the lesson binding, require a signed playback policy, and persist the verified asset ID, playback ID, and duration. No browser-supplied Mux metadata is trusted. Conditional writes prevent an older upload from replacing a newer binding. Existing playback remains available until a replacement is ready. Waiting, uploading, processing, ready, failed, and retry states are understandable to the Admin.

Mux requests use the current playback_policies field: [Mux direct-upload API](https://www.mux.com/docs/api-reference/video/direct-uploads/create-direct-upload).

5. Automation

New course and lesson addresses are generated with a normalized title and random suffix. Sections and lessons append after the highest stored position. Existing unique parent/position constraints arbitrate simultaneous inserts; a conflict triggers a fresh position read, with four bounded attempts and a friendly retry message. Existing rows are never shifted. Mux IDs and durations are server-managed. Resource paths and attachment IDs are created automatically.

6. Editing

Lesson edits update only title, description/content, content type, and lifecycle status. They retain existing slug, section, position, duration, Mux metadata, resource rows, and preview designation. Version checks reject stale lesson/section edits. Publishing requires a ready video, nonempty text, an attached file, or a valid external link as appropriate. External links are editable and updates are scoped to the lesson and resource type. Existing imported Mux lessons remain playable without a new upload.

7. Student behavior

The shared access helper checks student authorization, published lesson status, and active enrollment before content access. Course membership filters are supplied to service-role queries. Student curriculum and public course outlines omit draft and archived lessons; public outlines select only lesson metadata, not lesson bodies or video IDs. Existing video resume/progress behavior remains. Non-video lessons can be marked complete using the existing progress model, with pending, success, and retry feedback. Live-class completion records reading the lesson information, not attendance.

8. Visibility and Preview

Lessons retain Draft, Published, and Archived states. Courses retain Draft, Published, Unpublished, and Archived states. Draft/archived lessons are denied by loaders, token issuance, progress writes, and resource routes. Inclusive enrollment start and exclusive expiry rules remain unchanged. Legacy is_preview values are retained as metadata; they do not grant public content access. Public preview playback is intentionally not claimed or enabled. The new RLS restrictions become effective only when the unapplied migration is explicitly reviewed and applied.

9. Resource security

The lesson-resources bucket remains private. Upload creation requires Admin authorization, validates the permitted MIME/size limits, and creates a scoped path without overwrite permission. Attachment confirmation verifies actual storage size and MIME metadata and checks that the path belongs to the lesson and Admin. Stable resource IDs make attachment retries idempotent. Students must be actively enrolled in the published lesson before receiving a 60-second signed download URL or an external-link redirect. External links allow only http/https without URL credentials; protocols such as javascript, data, and ftp are denied. UI errors never render raw storage paths, Zod JSON, or service exceptions.

10. Migration

202610010002_course_builder_security.sql is a new forward migration and was NOT applied. It adds one nullable lessons.mux_upload_id column, needed to persist the latest server-created upload across requests/reloads without overwriting an existing playable asset. It also adds authorization helper functions and tightens lesson, resource, storage-read, and progress-write RLS. Application checks alone cannot protect direct Supabase access under the old policies. It preserves existing course content, Mux metadata, relationships, ordering, and storage limits. Existing preview flags remain stored, but their previous public-read permission is intentionally removed. Review and apply this migration before enabling the complete workflow in an environment. No historical migration, including the pre-existing uncommitted IBAN migration, was modified.

11. Exact files changed by this task (including this report)

- [src/actions/admin.ts](/C:/Builtbyskills/src/actions/admin.ts)
- [src/app/admin/course-builder/[courseId]/page.tsx](/C:/Builtbyskills/src/app/admin/course-builder/[courseId]/page.tsx)
- [src/app/admin/course-builder/page.tsx](/C:/Builtbyskills/src/app/admin/course-builder/page.tsx)
- [src/app/api/admin/lesson-resources/route.ts](/C:/Builtbyskills/src/app/api/admin/lesson-resources/route.ts)
- [src/app/api/mux/direct-upload/route.ts](/C:/Builtbyskills/src/app/api/mux/direct-upload/route.ts)
- [src/app/api/mux/playback-token/route.ts](/C:/Builtbyskills/src/app/api/mux/playback-token/route.ts)
- [src/app/api/student/progress/route.ts](/C:/Builtbyskills/src/app/api/student/progress/route.ts)
- [src/app/api/student/resources/[resourceId]/route.ts](/C:/Builtbyskills/src/app/api/student/resources/[resourceId]/route.ts)
- [src/app/courses/[slug]/page.tsx](/C:/Builtbyskills/src/app/courses/[slug]/page.tsx)
- [src/app/student/lessons/[lessonId]/page.tsx](/C:/Builtbyskills/src/app/student/lessons/[lessonId]/page.tsx)
- [src/components/admin/course-actions.tsx](/C:/Builtbyskills/src/components/admin/course-actions.tsx)
- [src/components/admin/thumbnail-upload-input.tsx](/C:/Builtbyskills/src/components/admin/thumbnail-upload-input.tsx)
- [src/components/admin/lesson-editor.tsx](/C:/Builtbyskills/src/components/admin/lesson-editor.tsx)
- [src/components/admin/lesson-resources.tsx](/C:/Builtbyskills/src/components/admin/lesson-resources.tsx)
- [src/components/admin/lesson-video-upload.tsx](/C:/Builtbyskills/src/components/admin/lesson-video-upload.tsx)
- [src/components/student/lesson-completion.tsx](/C:/Builtbyskills/src/components/student/lesson-completion.tsx)
- [src/components/student/mux-lesson-player.tsx](/C:/Builtbyskills/src/components/student/mux-lesson-player.tsx)
- [src/features/admin/data.ts](/C:/Builtbyskills/src/features/admin/data.ts)
- [src/features/student/data.ts](/C:/Builtbyskills/src/features/student/data.ts)
- [src/features/student/player-data.ts](/C:/Builtbyskills/src/features/student/player-data.ts)
- [src/lib/mux/server.ts](/C:/Builtbyskills/src/lib/mux/server.ts)
- [src/lib/lessons/access.ts](/C:/Builtbyskills/src/lib/lessons/access.ts)
- [src/lib/lessons/http.ts](/C:/Builtbyskills/src/lib/lessons/http.ts)
- [src/lib/lessons/ordering.ts](/C:/Builtbyskills/src/lib/lessons/ordering.ts)
- [src/lib/lessons/resources.ts](/C:/Builtbyskills/src/lib/lessons/resources.ts)
- [src/lib/validations/course-builder.ts](/C:/Builtbyskills/src/lib/validations/course-builder.ts)
- [src/types/lms.ts](/C:/Builtbyskills/src/types/lms.ts)
- [src/test/mocks/supabase.ts](/C:/Builtbyskills/src/test/mocks/supabase.ts)
- [supabase/migrations/202610010002_course_builder_security.sql](/C:/Builtbyskills/supabase/migrations/202610010002_course_builder_security.sql)
- [src/__tests__/integration/actions/admin.test.ts](/C:/Builtbyskills/src/__tests__/integration/actions/admin.test.ts)
- [src/__tests__/integration/actions/course-builder.test.ts](/C:/Builtbyskills/src/__tests__/integration/actions/course-builder.test.ts)
- [src/__tests__/integration/api/mux/course-video-upload.test.ts](/C:/Builtbyskills/src/__tests__/integration/api/mux/course-video-upload.test.ts)
- [src/__tests__/integration/api/student/lesson-access.test.ts](/C:/Builtbyskills/src/__tests__/integration/api/student/lesson-access.test.ts)
- [src/__tests__/integration/api/storage/lesson-resources.test.ts](/C:/Builtbyskills/src/__tests__/integration/api/storage/lesson-resources.test.ts)
- [src/__tests__/integration/features/student-data.test.ts](/C:/Builtbyskills/src/__tests__/integration/features/student-data.test.ts)
- [src/__tests__/integration/components/student-lesson-content.test.tsx](/C:/Builtbyskills/src/__tests__/integration/components/student-lesson-content.test.tsx)
- [src/__tests__/unit/components/admin/course-actions.test.tsx](/C:/Builtbyskills/src/__tests__/unit/components/admin/course-actions.test.tsx)
- [src/__tests__/unit/components/admin/lesson-authoring.test.tsx](/C:/Builtbyskills/src/__tests__/unit/components/admin/lesson-authoring.test.tsx)
- [src/__tests__/unit/components/admin/thumbnail-upload-errors.test.tsx](/C:/Builtbyskills/src/__tests__/unit/components/admin/thumbnail-upload-errors.test.tsx)
- [src/__tests__/unit/components/student/mux-lesson-player.test.tsx](/C:/Builtbyskills/src/__tests__/unit/components/student/mux-lesson-player.test.tsx)
- [src/__tests__/unit/lib/mux-upload.test.ts](/C:/Builtbyskills/src/__tests__/unit/lib/mux-upload.test.ts)
- [docs/course-builder-implementation-2026-10-01.md](/C:/Builtbyskills/docs/course-builder-implementation-2026-10-01.md)

12. Verification

The complete Vitest suite passed: 525 tests in 48 files. Coverage includes Admin authorization, automatic append/conflict handling, generated slugs, lesson editing and legacy metadata preservation, upload binding and processing/failure states, signed-only Mux creation, student playback/progress/resource authorization, draft/archived denial, enrollment boundaries, safe text/non-video rendering, private file metadata validation and retries, external URL validation, and existing payment behavior. npm run typecheck passed. Targeted ESLint passed with zero errors and the pre-existing thumbnail img warning. git diff --check passed. No unrelated .kilo lint changes were attempted.

13. Limitations and deferred work

No database migration or live Mux/Supabase smoke test was run. The new upload column and stronger direct-access RLS need explicit migration application before production use. Reordering is intentionally omitted; it needs a transactional design rather than unsafe adjacent updates. Public preview playback is intentionally omitted. Video finalization uses bounded polling rather than webhooks; reopening a lesson or checking its status resumes reconciliation. Video upload is a single request, with retry, rather than a resumable chunked uploader. Replaced/orphaned Mux assets and unattached storage uploads are not automatically deleted. Private resource removal and resource reordering are not added in this phase; existing attachments are preserved. Text is plain text, without an HTML/rich-text rendering pipeline. Live classes remain scheduled by course, independently of lesson records.

14. Working tree preservation

The current tree was inspected before editing. All unrelated uncommitted payment, enrollment, screenshot, branding, layout, animation, and authentication work was retained. Shared files were updated narrowly for this task. No credentials or environment files were read, printed, or modified. Nothing was committed, pushed, deployed, or applied to the database.
