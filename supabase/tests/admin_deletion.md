# Safe admin deletion verification

Do not run these tests against production. They require an isolated Supabase
database with the corrected migration already installed by the normal migration
process. Test commands below do not install it.

Run the rollback-only regression SQL as postgres:

```powershell
psql -X -v ON_ERROR_STOP=1 -d <disposable-test-connection> -f supabase/tests/admin_deletion.sql
```

It verifies stale/replayed deletion, validated immediate RESTRICT behavior,
direct and RPC rejection of referenced deletions, reference preservation, NULL
references, rejection of orphan inserts, successful unreferenced deletion and
exactly one audit, rejected missing/inactive/suspended/demoted administrators,
service-role execution privileges, SECURITY DEFINER and empty search_path.

Run the actual two-session race regression with PostgreSQL's isolationtester:

```powershell
$env:PATH = 'C:/Program Files/PostgreSQL/18/bin;' + $env:PATH
Get-Content -Raw supabase/tests/admin_deletion_race.spec | & 'C:/Program Files/PostgreSQL/18/lib/pgxs/src/test/isolation/isolationtester.exe' '<disposable-test-connection>'
```

Each permutation installs/removes committed fixtures. Fixed fixture IDs/email
fail on collision. If interrupted, remove only these test fixtures in the
disposable database (audit, payment, method, course, then profile). PASS requires no ERROR output
and all six permutations: suspend/demote must show `<waiting ...>` after an
authorized deletion and complete only after delete_commit; delete_denied must
show `<waiting ...>` when the profile update started first and complete after
change_commit. SQL assertions fail if authorization, method or audit behavior is
wrong. Waiting output is essential: sequential assertions alone cannot prove
the lock prevents an update while deletion proceeds. In the FK permutations,
delete_referenced waits for payment_commit and preserves the method/reference;
payment_denied waits for delete_commit and rejects the missing method. Both
must show waiting and complete without an assertion error.

## Production preflight (read-only)

Confirm the migration version is absent and inspect the existing FK:

```sql
select version from supabase_migrations.schema_migrations
where version = '202610020003'; -- expect zero rows

select c.conname, pg_catalog.pg_get_constraintdef(c.oid) as definition,
       c.convalidated, c.condeferrable
from pg_catalog.pg_constraint c
where c.conrelid = 'public.payment_submissions'::regclass
  and c.contype = 'f';
-- Expect payment_submissions_payment_method_id_fkey referencing
-- public.payment_methods(id); investigate unexpected schema differences.

select count(*) as orphan_references
from public.payment_submissions p
left join public.payment_methods m on m.id = p.payment_method_id
where p.payment_method_id is not null and m.id is null; -- must be zero

select count(*) as payments,
       count(*) filter (where payment_method_id is null) as historical_nulls
from public.payment_submissions;

select r.rolname from pg_catalog.pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role'); -- expect all three

select p.oid::regprocedure as function, p.proowner::regrole as owner,
       p.prosecdef, p.proconfig, p.proacl
from pg_catalog.pg_proc p
where p.oid = pg_catalog.to_regprocedure(
  'public.delete_unreferenced_payment_method(uuid,timestamptz,uuid)');
-- Normally absent before this new migration. Investigate an existing definition
-- or custom grants: CREATE OR REPLACE preserves ownership and existing ACLs.

select pid, usename, state, xact_start, wait_event_type, wait_event
from pg_catalog.pg_stat_activity
where datname = pg_catalog.current_database() and pid <> pg_catalog.pg_backend_pid()
  and xact_start is not null
order by xact_start;

select pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(
  'public.payment_submissions')) as submissions_size;
```

Save payment IDs/payment_method_id pairs for exact before/after comparison if
needed; aggregate counts alone do not prove unchanged attribution. Take the
normal backup and verify restore readiness. Check the migration role owns (or
can alter) the tables/function and can grant to service_role; investigate any
preexisting RPC or custom grants/role memberships. Confirm the runner stops on
SQL errors and supports this BEGIN/COMMIT wrapper.

Use a low-traffic maintenance window: dropping the FK takes ACCESS EXCLUSIVE on
payment_submissions, and adding the validated FK scans existing references and
locks payment_methods. Locks persist through commit; this atomic approach
deliberately avoids an enforcement gap. The local 5-second lock timeout aborts
the transaction on contention; it is not a bound on total validation time.
Estimate validation time on a representative isolated copy and check the
runner's statement timeout. If a lock/validation/function/grant fails, the entire
migration rolls back; resolve the cause and retry through the normal runner.
Do not bypass validation or delete historical data to make it pass.
