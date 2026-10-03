# Admin deletion safety

Apply `supabase/migrations/202610020003_safe_admin_deletion.sql` before using payment-method deletion. It changes only the payment-method foreign key from SET NULL to RESTRICT and adds a service-role-only atomic deletion/audit RPC. This is necessary because an application reference check followed by deletion would race new submissions and silently lose historical attribution. Existing migrations and historical rows are unchanged. Before this migration, the new payment Delete action fails safely because its RPC is unavailable.

## Relationship review

The migration schema defines instructors as profiles, with an optional auth_user_id pointing to Auth. Deleting a profile would cascade instructor_courses (instructor_id), enrollments (student_id), lesson_progress (student_id), and notifications (profile_id). It would null attribution in courses and live_classes (instructor_id), instructor_courses and enrollments (assigned_by), payment_submissions (student_id/reviewed_by), announcements (author_id), and audit_logs (actor_id). Audit entity_id and metadata also retain historical identifiers without FKs. Lessons reference sections, which reference courses, rather than instructors directly. Enrollment requests link courses and payment submissions. Subsequent migrations do not add further instructor/payment-method references.

Therefore Instructor Delete always retires the selected instructor via profile status=inactive. It never deletes profiles or Auth users, removes assignments, or mutates related business/history records. The existing authorization logic blocks inactive profiles from dashboard access. Edit changes only full_name, phone, whatsapp, and status on a row still having instructor role. Login email, role, Auth metadata, avatar, provisioning and password flows are preserved.

Payment methods are referenced by payment_submissions.payment_method_id; enrollment requests/history reach them through those submissions. Any submission, regardless of approval status, blocks permanent deletion with a message to use the existing deactivation control. Unreferenced methods are deleted atomically with an audit entry. RESTRICT enforces integrity under concurrent submissions as well as ordinary requests.

Contact submissions have no inbound references in the migration schema. Deletion targets only the selected id and updated_at. Existing status updates and other contacts are unchanged.

Every new action requires the existing active super_admin authorization (the schema has no separate admin role). All mutations validate UUID and timestamp. Deletes additionally require explicit confirmation; version matching rejects stale/replayed mutations. Radix confirmation dialogs provide focus trapping/restoration, accessible titles/descriptions, safe initial focus on Cancel, and pending-state protection.

## Validation

Focused Vitest run: 100 tests passed across new admin-record and confirmation tests, existing instructor and payment method components, admin actions, and payment approval actions. TypeScript, targeted ESLint, and git diff --check passed.

`supabase/tests/admin_deletion.sql` is a rollback-only database regression script for stale requests, referenced record/history preservation, safe unreferenced deletion, replay, RPC grants, and inactive administrator rejection. It has not been executed here because PostgreSQL/Supabase CLI is unavailable. Run it in an isolated migrated Supabase database before deploying. Concurrent FK safety is provided by PostgreSQL RESTRICT; no live concurrent database test was run here.
