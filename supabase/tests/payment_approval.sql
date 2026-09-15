-- Run only as postgres on a disposable Supabase DB after all migrations.
-- Auth rows are fixtures: this tests PostgreSQL, not hosted Auth API/email.
\set ON_ERROR_STOP on
begin;

create function pg_temp.fixture_id(label text) returns uuid language sql immutable
as $$ select md5('builtbyskills-feature5-test:' || label)::uuid $$;
create function pg_temp.check_that(condition boolean, label text) returns void language plpgsql
as $$ begin
  if condition is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users(id, email, email_confirmed_at) values
  (pg_temp.fixture_id('admin-auth'), 'f5-admin@example.invalid', now());
insert into public.profiles(id, auth_user_id, full_name, email, role, status) values
  (pg_temp.fixture_id('admin-profile'), pg_temp.fixture_id('admin-auth'), 'Test Admin', 'f5-admin@example.invalid', 'super_admin', 'active');
insert into public.courses(id, title, slug, short_description, description, category, level, status) values
  (pg_temp.fixture_id('course'), 'Test Course', 'feature5-test-course', 'Test', 'Test', 'Test', 'Test', 'published');

create function pg_temp.payment(label text, email_address text) returns uuid language plpgsql as $$
declare payment_id uuid := pg_temp.fixture_id('payment-' || label);
begin
  insert into public.payment_submissions(id, course_id, amount, status)
    values(payment_id, pg_temp.fixture_id('course'), 100, 'pending');
  insert into public.enrollment_requests(id, payment_submission_id, full_name, email, phone, city,
    course_id, preferred_batch, experience_level, status)
    values(pg_temp.fixture_id('request-' || label), payment_id, 'Request Name', email_address,
      '123456789', 'Test City', pg_temp.fixture_id('course'), 'Test Batch', 'Beginner', 'pending');
  return payment_id;
end $$;
create function pg_temp.auth_student(label text, email_address text, has_password boolean default false)
returns uuid language plpgsql as $$
declare auth_id uuid := pg_temp.fixture_id('auth-' || label);
begin
  insert into auth.users(id, email, email_confirmed_at, encrypted_password, raw_user_meta_data, raw_app_meta_data)
    values(auth_id, email_address, now(), case when has_password then 'fixture-not-a-real-hash' else '' end,
      '{"role":"student"}', '{"payment_provisioned":true}');
  return auth_id;
end $$;
create function pg_temp.approve(payment_id uuid, finalize boolean default false, auth_id uuid default null)
returns jsonb language sql as $$
  select public.approve_student_payment(payment_id, pg_temp.fixture_id('admin-profile'), finalize, auth_id)
$$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare p uuid; a uuid; s uuid; result jsonb; before_enrollment jsonb;
begin
  p := pg_temp.payment('new', ' New.Student@Example.Invalid ');
  result := pg_temp.approve(p);
  perform pg_temp.check_that((result->>'ok')::boolean and result->>'auth_user_id' is null
    and result->>'email' = 'new.student@example.invalid', 'new identity preflight normalizes email');
  perform pg_temp.check_that(not exists(select 1 from public.profiles where email = 'new.student@example.invalid'),
    'preflight does not create a profile or approve');
  a := pg_temp.auth_student('new', 'new.student@example.invalid');
  result := pg_temp.approve(p, true, a);
  perform pg_temp.check_that((result->>'ok')::boolean and (result->>'activation')::boolean, 'new account requires activation');
  select id into s from public.profiles where auth_user_id = a;
  perform pg_temp.check_that(s is not null and s <> a, 'profile ID is distinct from Auth ID');
  perform pg_temp.check_that(exists(select 1 from public.payment_submissions where id = p and student_id = s
    and status = 'approved' and reviewed_by = pg_temp.fixture_id('admin-profile') and reviewed_at is not null), 'payment linked and approved');
  perform pg_temp.check_that(exists(select 1 from public.enrollment_requests where payment_submission_id = p and status = 'active'), 'request linked through payment and active');
  perform pg_temp.check_that(exists(select 1 from public.enrollments where student_id = s
    and course_id = pg_temp.fixture_id('course') and status = 'active' and starts_at = now()), 'correct active course enrollment');
  select to_jsonb(e) into before_enrollment from public.enrollments e where student_id = s;
  result := pg_temp.approve(p, true, a);
  perform pg_temp.check_that((result->>'already_approved')::boolean, 'repeat approval is a no-op');
  perform pg_temp.check_that((select count(*) = 1 from public.profiles where auth_user_id = a)
    and (select count(*) = 1 from public.enrollments where student_id = s)
    and (select count(*) = 1 from public.audit_logs where entity_id = p), 'no duplicate profile/enrollment/receipt');
  perform pg_temp.check_that(before_enrollment = (select to_jsonb(e) from public.enrollments e where student_id = s), 'repeat preserves enrollment dates and history');
  -- Another payment for the same identity/course preserves the row and does not
  -- request another activation, even if the first email receipt is still pending.
  p := pg_temp.payment('new-second', 'NEW.STUDENT@example.invalid');
  result := pg_temp.approve(p, true, a);
  perform pg_temp.check_that((result->>'ok')::boolean and not (result->>'activation')::boolean,
    'different payment reuses enrollment without duplicate activation');
  perform pg_temp.check_that(before_enrollment = (select to_jsonb(e) from public.enrollments e where student_id = s), 'active enrollment untouched');
end $$;

do $$
declare p uuid; a uuid; s uuid; result jsonb; before_profile jsonb; before_enrollment jsonb;
begin
  a := pg_temp.auth_student('existing', 'existing@example.invalid', true);
  s := pg_temp.fixture_id('existing-profile');
  insert into public.profiles(id, auth_user_id, full_name, email, phone, role, status)
    values(s, a, 'Original Name', 'Existing@Example.Invalid', 'original phone', 'student', 'active');
  insert into public.enrollments(student_id, course_id, status, starts_at, expires_at)
    values(s, pg_temp.fixture_id('course'), 'pending', '2099-01-01', '2100-01-01');
  select to_jsonb(v) into before_profile from public.profiles v where id = s;
  p := pg_temp.payment('existing', 'existing@example.invalid');
  result := pg_temp.approve(p);
  perform pg_temp.check_that(result->>'auth_user_id' = a::text, 'existing Auth is reused');
  result := pg_temp.approve(p, true, a);
  perform pg_temp.check_that((result->>'ok')::boolean and not (result->>'activation')::boolean, 'existing usable account gets no activation');
  perform pg_temp.check_that(before_profile = (select to_jsonb(v) from public.profiles v where id = s), 'existing profile preserved byte for byte');
  perform pg_temp.check_that(exists(select 1 from public.enrollments where student_id = s and status = 'active'
    and starts_at = '2099-01-01' and expires_at = '2100-01-01'), 'pending enrollment activates without changing start or expiry');
  -- Linked payment without an enrollment request is also supported.
  insert into public.payment_submissions(id, student_id, course_id, amount, status)
    values(pg_temp.fixture_id('linked-payment'), s, pg_temp.fixture_id('course'), 100, 'under_review');
  result := pg_temp.approve(pg_temp.fixture_id('linked-payment'), true, a);
  perform pg_temp.check_that((result->>'ok')::boolean, 'linked student payment works without visitor request');
end $$;

do $$
declare role_name text; status_name text; label text; p uuid; a uuid; s uuid; result jsonb; snapshot jsonb;
begin
  foreach role_name in array array['super_admin', 'instructor', 'student'] loop
    foreach status_name in array array['active', 'inactive', 'suspended'] loop
      if role_name = 'student' and status_name = 'active' then continue; end if;
      label := role_name || '-' || status_name;
      a := pg_temp.auth_student(label, label || '@example.invalid', true);
      s := pg_temp.fixture_id('profile-' || label);
      insert into public.profiles(id, auth_user_id, full_name, email, role, status)
        values(s, a, 'Protected Identity', label || '@example.invalid', role_name::public.user_role, status_name::public.profile_status);
      select to_jsonb(v) into snapshot from public.profiles v where id = s;
      p := pg_temp.payment(label, upper(label) || '@example.invalid');
      result := pg_temp.approve(p, true, a);
      perform pg_temp.check_that(result->>'reason' = 'identity_conflict', 'reject incompatible ' || label);
      perform pg_temp.check_that(snapshot = (select to_jsonb(v) from public.profiles v where id = s), 'preserve role/status/linkage ' || label);
      perform pg_temp.check_that(exists(select 1 from public.payment_submissions where id = p and status = 'pending'), 'conflict leaves payment pending');
    end loop;
  end loop;
end $$;

do $$
declare p uuid; a uuid; other_auth uuid; result jsonb;
begin
  a := pg_temp.auth_student('mismatch', 'mismatch@example.invalid', true);
  other_auth := pg_temp.auth_student('other', 'other@example.invalid', true);
  insert into public.profiles(id, auth_user_id, full_name, email, role, status)
    values(pg_temp.fixture_id('mismatch-profile'), other_auth, 'Mismatch', 'mismatch@example.invalid', 'student', 'active');
  p := pg_temp.payment('mismatch', 'mismatch@example.invalid');
  perform pg_temp.check_that(pg_temp.approve(p, true, a)->>'reason' = 'identity_conflict', 'mismatched Auth/profile rejected');
  a := pg_temp.auth_student('orphan-privileged', 'orphan-privileged@example.invalid');
  update auth.users set raw_user_meta_data = '{"role":"instructor"}' where id = a;
  p := pg_temp.payment('orphan-privileged', 'orphan-privileged@example.invalid');
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'identity_conflict', 'orphan privileged Auth rejected');
  -- Legacy active student without an Auth link can be linked by trusted code.
  a := pg_temp.auth_student('legacy', 'legacy@example.invalid');
  insert into public.profiles(id, full_name, email, role, status)
    values(pg_temp.fixture_id('legacy-profile'), 'Legacy Name', 'legacy@example.invalid', 'student', 'active');
  p := pg_temp.payment('legacy', 'legacy@example.invalid');
  result := pg_temp.approve(p, true, a);
  perform pg_temp.check_that((result->>'ok')::boolean and (result->>'activation')::boolean, 'legacy student linked and activated');
  perform pg_temp.check_that(exists(select 1 from public.profiles where id = pg_temp.fixture_id('legacy-profile')
    and auth_user_id = a and full_name = 'Legacy Name' and role = 'student' and status = 'active'), 'Feature 1 allows trusted linkage without profile overwrite');
  -- Duplicate case variants must not be guessed or merged.
  insert into public.profiles(full_name, email, role, status) values('Duplicate', 'LEGACY@example.invalid', 'instructor', 'active');
  p := pg_temp.payment('duplicate-case', 'legacy@example.invalid');
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'identity_conflict', 'ambiguous normalized profiles rejected');
end $$;

do $$
declare p uuid; a uuid; s uuid; status_name text;
begin
  a := pg_temp.auth_student('restricted-enrollment', 'restricted-enrollment@example.invalid', true);
  s := pg_temp.fixture_id('restricted-enrollment-profile');
  insert into public.profiles(id, auth_user_id, full_name, email) values(s, a, 'Student', 'restricted-enrollment@example.invalid');
  insert into public.enrollments(student_id, course_id, status) values(s, pg_temp.fixture_id('course'), 'suspended');
  p := pg_temp.payment('restricted-enrollment', 'restricted-enrollment@example.invalid');
  foreach status_name in array array['suspended', 'completed', 'expired', 'cancelled'] loop
    update public.enrollments set status = status_name::public.enrollment_status where student_id = s;
    perform pg_temp.check_that(pg_temp.approve(p, true, a)->>'reason' = 'enrollment_conflict', 'preserve restricted enrollment ' || status_name);
  end loop;
  update public.enrollments set status = 'active', expires_at = now() - interval '1 day' where student_id = s;
  perform pg_temp.check_that(pg_temp.approve(p, true, a)->>'reason' = 'enrollment_conflict', 'expired time window not silently extended');
  update public.payment_submissions set status = 'rejected' where id = p;
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'invalid_state', 'rejected cannot approve directly');
  update public.payment_submissions set status = 'refunded' where id = p;
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'invalid_state', 'refunded cannot approve');
  p := pg_temp.payment('legacy-approved', 'unlinked@example.invalid');
  update public.payment_submissions set status = 'approved' where id = p;
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'incomplete_approval', 'legacy broken approval requires review');
end $$;

do $$
declare p uuid; a uuid; other_profile uuid;
begin
  p := pg_temp.payment('request-mismatch', 'request-mismatch@example.invalid');
  update public.enrollment_requests set course_id = pg_temp.fixture_id('course') where payment_submission_id = p;
  -- A second real course permits a mismatch without breaking FK constraints.
  insert into public.courses(id, title, slug, short_description, description, category, level)
    values(pg_temp.fixture_id('other-course'), 'Other', 'f5-other', 'Test', 'Test', 'Test', 'Test');
  update public.enrollment_requests set course_id = pg_temp.fixture_id('other-course') where payment_submission_id = p;
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'invalid_request', 'course/request mismatch rejected');
  insert into public.payment_submissions(id, course_id, amount)
    values(pg_temp.fixture_id('missing-request'), pg_temp.fixture_id('course'), 100);
  perform pg_temp.check_that(pg_temp.approve(pg_temp.fixture_id('missing-request'))->>'reason' = 'invalid_request', 'unlinked visitor without request rejected');
  perform pg_temp.check_that(pg_temp.approve(pg_temp.fixture_id('missing-payment'))->>'reason' = 'missing_payment', 'missing payment rejected');
  a := pg_temp.auth_student('changed-identity', 'changed-identity@example.invalid');
  p := pg_temp.payment('changed-identity', 'changed-identity@example.invalid');
  perform pg_temp.check_that(pg_temp.approve(p, true, pg_temp.fixture_id('wrong-auth'))->>'reason' = 'identity_changed', 'finalization verifies expected Auth identity');
  perform pg_temp.check_that(not exists(select 1 from public.profiles where auth_user_id = a), 'identity mismatch leaves no new profile');
  update auth.users set banned_until = now() + interval '1 day' where id = a;
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'identity_conflict', 'banned Auth account rejected');
  insert into public.profiles(id, full_name, email, role, status)
    values(pg_temp.fixture_id('privileged-no-auth'), 'Privileged', 'privileged-no-auth@example.invalid', 'instructor', 'inactive');
  p := pg_temp.payment('privileged-no-auth', 'privileged-no-auth@example.invalid');
  perform pg_temp.check_that(pg_temp.approve(p)->>'reason' = 'identity_conflict', 'privileged profile without Auth blocked before provisioning');
  a := pg_temp.auth_student('payment-link', 'payment-link@example.invalid', true);
  insert into public.profiles(id, auth_user_id, full_name, email)
    values(pg_temp.fixture_id('payment-link-profile'), a, 'Student', 'payment-link@example.invalid');
  p := pg_temp.payment('payment-link', 'payment-link@example.invalid');
  update public.payment_submissions set student_id = pg_temp.fixture_id('existing-profile') where id = p;
  perform pg_temp.check_that(pg_temp.approve(p, true, a)->>'reason' = 'identity_conflict', 'payment already linked to different student is rejected');
end $$;

-- Approved-state replay must validate actual access without repairing any row.
create function pg_temp.replay_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'payments', (select jsonb_agg(to_jsonb(t) order by id) from public.payment_submissions t),
    'requests', (select jsonb_agg(to_jsonb(t) order by id) from public.enrollment_requests t),
    'profiles', (select jsonb_agg(to_jsonb(t) order by id) from public.profiles t),
    'enrollments', (select jsonb_agg(to_jsonb(t) order by id) from public.enrollments t),
    'audit', (select jsonb_agg(to_jsonb(t) order by id) from public.audit_logs t)
  )
$$;
create function pg_temp.check_replay(p uuid, a uuid, label text, expected_reason text default null)
returns void language plpgsql as $$
declare snapshot jsonb := pg_temp.replay_snapshot(); result jsonb; finalize boolean;
begin
  foreach finalize in array array[false, true] loop
    result := pg_temp.approve(p, finalize, case when finalize then a else null end);
    if expected_reason is null then
      perform pg_temp.check_that((result->>'ok')::boolean and (result->>'already_approved')::boolean, label);
    else
      perform pg_temp.check_that(result->>'ok' = 'false' and result->>'reason' = expected_reason
        and not coalesce((result->>'already_approved')::boolean, false), label);
    end if;
    perform pg_temp.check_that(snapshot = pg_temp.replay_snapshot(), label || ': replay changed no data');
  end loop;
end $$;
do $$
declare p uuid; a uuid; other_auth uuid; s uuid; status_name text; bounds record; snapshot jsonb; result jsonb;
begin
  a := pg_temp.auth_student('replay', 'replay@example.invalid', true);
  other_auth := pg_temp.auth_student('replay-other', 'replay-other@example.invalid', true);
  s := pg_temp.fixture_id('replay-profile');
  insert into public.profiles(id, auth_user_id, full_name, email)
    values(s, a, 'Replay Student', 'replay@example.invalid');
  p := pg_temp.payment('replay', 'replay@example.invalid');
  update public.payment_submissions set student_id = s, status = 'approved' where id = p;
  update public.enrollment_requests set status = 'active' where payment_submission_id = p;
  insert into public.enrollments(student_id, course_id, status)
    values(s, pg_temp.fixture_id('course'), 'active');
  perform pg_temp.check_replay(p, a, 'approved + active unbounded enrollment succeeds');
  foreach status_name in array array['pending', 'suspended', 'completed', 'expired', 'cancelled'] loop
    update public.enrollments set status = status_name::public.enrollment_status where student_id = s;
    perform pg_temp.check_replay(p, a, 'approved + ' || status_name || ' is incomplete', 'incomplete_approval');
  end loop;
  update public.enrollments set status = 'active' where student_id = s;
  -- now() is stable for this transaction, so equality tests are exact.
  for bounds in select * from (values
    ('null bounds', null::timestamptz, null::timestamptz, true),
    ('start equality included', now(), null::timestamptz, true),
    ('future start excluded', now() + interval '1 second', null::timestamptz, false),
    ('expiry equality excluded', null::timestamptz, now(), false),
    ('past expiry excluded', null::timestamptz, now() - interval '1 second', false),
    ('null start future expiry', null::timestamptz, now() + interval '1 second', true),
    ('past start null expiry', now() - interval '1 second', null::timestamptz, true),
    ('valid bounded interval', now(), now() + interval '1 second', true),
    ('empty interval', now(), now(), false),
    ('reversed interval', now() + interval '1 second', now() - interval '1 second', false)
  ) as cases(label, starts_at, expires_at, usable) loop
    update public.enrollments set starts_at = bounds.starts_at, expires_at = bounds.expires_at where student_id = s;
    perform pg_temp.check_replay(p, a, bounds.label, case when bounds.usable then null else 'incomplete_approval' end);
  end loop;
  update public.enrollments set starts_at = null, expires_at = null where student_id = s;
  update public.enrollment_requests set status = 'pending' where payment_submission_id = p;
  perform pg_temp.check_replay(p, a, 'pending request is incomplete', 'incomplete_approval');
  update public.enrollment_requests set status = 'active' where payment_submission_id = p;
  update public.payment_submissions set student_id = pg_temp.fixture_id('existing-profile') where id = p;
  perform pg_temp.check_replay(p, a, 'mismatched payment student rejected', 'identity_conflict');
  update public.payment_submissions set student_id = s where id = p;
  update public.profiles set auth_user_id = other_auth where id = s;
  perform pg_temp.check_replay(p, a, 'mismatched profile Auth rejected', 'identity_conflict');
  update public.profiles set auth_user_id = null where id = s;
  perform pg_temp.check_replay(p, a, 'missing Auth linkage is incomplete', 'incomplete_approval');
  update public.profiles set auth_user_id = a where id = s;
  snapshot := pg_temp.replay_snapshot();
  result := pg_temp.approve(p, true, other_auth);
  perform pg_temp.check_that(result->>'reason' = 'identity_changed', 'finalization replay checks expected Auth ID');
  perform pg_temp.check_that(snapshot = pg_temp.replay_snapshot(), 'wrong expected Auth ID causes no writes');
  delete from public.enrollment_requests where payment_submission_id = p;
  perform pg_temp.check_replay(p, a, 'linked payment without optional request remains supported');
  delete from public.enrollments where student_id = s;
  perform pg_temp.check_replay(p, a, 'missing enrollment is incomplete', 'incomplete_approval');
end $$;

-- Fault injection proves DB rollback; Auth creation remains outside this RPC.
create function pg_temp.fail_payment_write() returns trigger language plpgsql as $$
begin
  if current_setting('test.payment_failure', true) = tg_table_name then
    raise exception 'Injected write failure' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger f5_test_failure before insert on public.profiles for each row execute function pg_temp.fail_payment_write();
create trigger f5_test_failure before insert on public.enrollments for each row execute function pg_temp.fail_payment_write();
create trigger f5_test_failure before insert on public.audit_logs for each row execute function pg_temp.fail_payment_write();
do $$
declare table_name text; p uuid; a uuid; result jsonb;
begin
  foreach table_name in array array['profiles', 'enrollments', 'audit_logs'] loop
    p := pg_temp.payment('failure-' || table_name, table_name || '@example.invalid');
    a := pg_temp.auth_student('failure-' || table_name, table_name || '@example.invalid');
    perform set_config('test.payment_failure', table_name, true);
    result := pg_temp.approve(p, true, a);
    perform pg_temp.check_that(result->>'reason' = 'finalization_failed', table_name || ' failure is reported');
    perform pg_temp.check_that(not exists(select 1 from public.profiles where auth_user_id = a)
      and exists(select 1 from auth.users where id = a)
      and exists(select 1 from public.payment_submissions where id = p and status = 'pending' and student_id is null)
      and exists(select 1 from public.enrollment_requests where payment_submission_id = p and status = 'pending')
      and not exists(select 1 from public.audit_logs where entity_id = p), 'all DB approval writes roll back while Auth remains reusable');
    perform set_config('test.payment_failure', '', true);
    result := pg_temp.approve(p);
    perform pg_temp.check_that(result->>'auth_user_id' = a::text, 'retry resolves existing Auth');
    result := pg_temp.approve(p, true, a);
    perform pg_temp.check_that((result->>'ok')::boolean and (result->>'activation')::boolean, 'retry finalizes once');
  end loop;
end $$;

select pg_temp.check_that(not has_function_privilege('anon', 'public.approve_student_payment(uuid,uuid,boolean,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.approve_student_payment(uuid,uuid,boolean,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.approve_student_payment(uuid,uuid,boolean,uuid)', 'EXECUTE'), 'only service_role has API execution grant');
select pg_temp.check_that(public.approve_student_payment(pg_temp.fixture_id('payment-new'), pg_temp.fixture_id('legacy-profile'))->>'reason' = 'unauthorized', 'non-admin actor rejected by RPC');
set local role service_role;
select public.approve_student_payment(pg_temp.fixture_id('payment-new'), pg_temp.fixture_id('admin-profile'));
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.approve_student_payment(null, null);
    raise exception 'FAIL: authenticated executed privileged RPC';
  exception when insufficient_privilege then raise notice 'PASS: authenticated execution denied'; end;
end $$;
reset role;
rollback;
\echo 'Payment approval SQL regression checks passed; fixtures rolled back.'
