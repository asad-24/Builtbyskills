# Payment approval verification

Apply `202609140002_safe_payment_approval.sql` through the normal migration process
before deploying the updated action. It adds one service-role-only RPC, no tables,
columns, enums, data rewrites, or new relationships. Historical migrations and
Feature 1 remain unchanged.

Also apply `202610020002_payment_password_setup.sql` before using the updated
approval code. It replaces the RPC without changing tables or existing records.
Supabase Auth's admin `createUser` generates a random password when no password
is supplied; a non-empty hash alone does not prove student account setup. New
payment accounts receive the service-owned `payment_password_setup_required`
marker. The RPC permits first activation for those accounts only while
`last_sign_in_at` is null, still subject to the prior-activation receipt guard.
Existing non-empty-password accounts without that marker are unchanged, even
if they have never signed in. Password recovery establishes a sign-in session,
so completed setup is excluded without altering the working recovery flow.

The single payment approval email includes the generated recovery link when
activation is required. Link-generation failure records failed email status;
approval replay never sends another email. Already approved historical accounts
are not rewritten or resent: affected students can use Forgot password.

On a **disposable Supabase database**, after applying repository migrations, run:

```powershell
psql -X -h 127.0.0.1 -p 54322 -U postgres -d postgres -W -v ON_ERROR_STOP=1 -f supabase/tests/payment_approval.sql
```

The script runs in a transaction and rolls back fixtures, test functions, and
fault-injection triggers. It tests normalized identity resolution, Auth/profile ID
distinction, privileged/inactive profile conflicts, orphan Auth conflicts, trusted
legacy profile linking with Feature 1 installed, enrollment uniqueness and dates,
payment/request linkage, repeats, status restrictions, and rollback/retry after
profile, enrollment, and audit failures. Auth rows are fixtures, not Auth API calls.

Vitest tests mock the RPC, Auth API, and email provider. They verify action ordering,
error handling, retries, authorization, and Feature 4 link generation; they do not
execute PostgreSQL or prove concurrent transaction behavior. The SQL script must
be executed separately; do not infer it passed from passing Vitest tests.

For a hosted/staging smoke test, approve a fresh visitor payment, use its activation
email to set a password, and verify course access and payment history. Repeat the
approval and verify no additional enrollment or activation mail. Also issue two
approvals concurrently for the same payment and for separate payments sharing an
email/course: one transaction should finalize each payment, sharing one profile
and enrollment. Use separate disposable accounts; do not test against real users.

## Failure and retry contract

- Only pending/under-review payments can be approved. Rejected payments must first
  be moved to under review. Refunded payments cannot be approved. Non-approval
  reviews use a conditional status update so stale reviews cannot undo approval.
- Existing active students are reused. Suspended/inactive profiles and restricted
  or expired enrollments require explicit administrative resolution; approval
  never reactivates them. Existing pending enrollment start/expiry dates survive.
- Auth creation uses the existing confirmed-user pattern and a server-owned
  `payment_provisioned` and `payment_password_setup_required` marker. If database finalization fails, retry resolves that
  Auth user and finalizes the profile/enrollment without another Auth creation.
- Database finalization is atomic, including its `payment.reviewed` audit receipt.
  An audit insertion failure rolls back that transaction. Auth and email are not
  part of that transaction. A lost response reports uncertainty and permits retry.
- The winning transaction reserves the email attempt in existing audit metadata.
  Only that caller generates/sends an activation link. A duplicate approval does
  not generate another link or email. Email failures and an interrupted process
  after commit leave enrollment approved; replay reports unconfirmed delivery and
  directs the student to Feature 4 Forgot password. This deliberately offers one
  automatic email attempt, not guaranteed delivery or an email retry queue.
- A previously approved legacy payment lacking identity/enrollment linkage is
  reported for manual review rather than silently marked repaired.

The request has no direct student/enrollment foreign key. Its existing
`payment_submission_id` now leads to `payment_submissions.student_id` and the
unique `(student_id, course_id)` enrollment. No speculative schema was added.
