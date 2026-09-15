-- Run as postgres on a disposable Supabase database after all migrations.
-- No seeds or existing users are needed. All fixtures and grants roll back.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('f1400000-0000-4000-8000-000000000001', 'profile-guard-student@example.invalid'),
  ('f1400000-0000-4000-8000-000000000002', 'profile-guard-other@example.invalid'),
  ('f1400000-0000-4000-8000-000000000003', 'profile-guard-admin@example.invalid');

insert into public.profiles (id, auth_user_id, full_name, email, role, status) values
  ('f1410000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000001', 'Guard Student', 'profile-guard-student@example.invalid', 'student', 'active'),
  ('f1410000-0000-4000-8000-000000000002', 'f1400000-0000-4000-8000-000000000002', 'Guard Other', 'profile-guard-other@example.invalid', 'student', 'active'),
  ('f1410000-0000-4000-8000-000000000003', 'f1400000-0000-4000-8000-000000000003', 'Guard Admin', 'profile-guard-admin@example.invalid', 'super_admin', 'active');

-- Deliberately broad grants prove the trigger works even with table UPDATE.
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1400000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"f1400000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  assignment text;
  affected integer;
begin
  foreach assignment in array array[
    'role = ''super_admin''',
    'status = ''inactive''',
    'auth_user_id = null',
    'auth_user_id = ''f1400000-0000-4000-8000-000000000002''',
    'id = ''f1410000-0000-4000-8000-000000000099''',
    'email = ''hijacked@example.invalid''',
    'created_at = ''2000-01-01T00:00:00Z'''
  ] loop
    begin
      execute 'update public.profiles set ' || assignment ||
        ' where id = ''f1410000-0000-4000-8000-000000000001''';
      raise exception 'FAIL: protected update succeeded: %', assignment;
    exception when insufficient_privilege then
      raise notice 'PASS: denied %', assignment;
    end;
  end loop;

  update public.profiles set full_name = 'Cross-user write'
    where id = 'f1410000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: cross-user update succeeded'; end if;
  raise notice 'PASS: RLS filtered cross-user update';

  update public.profiles
    set full_name = 'Updated Student', phone = '1234567', whatsapp = '7654321',
        avatar_url = '/img/BBS LOGO.png', updated_at = '2000-01-01T00:00:00Z',
        role = role, status = status, auth_user_id = auth_user_id
    where id = 'f1410000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (
    select 1 from public.profiles
    where id = 'f1410000-0000-4000-8000-000000000001'
      and full_name = 'Updated Student' and phone = '1234567'
      and whatsapp = '7654321' and avatar_url = '/img/BBS LOGO.png'
      and updated_at = now() and role = 'student' and status = 'active'
  ) then raise exception 'FAIL: allowed self-edit or automatic timestamp failed'; end if;
  raise notice 'PASS: personal fields and automatic timestamp preserved';
end;
$$;

-- An already active super admin may manage another profile via authenticated.
select set_config('request.jwt.claim.sub', 'f1400000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"f1400000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare affected integer;
begin
  update public.profiles set role = 'instructor', status = 'suspended'
    where id = 'f1410000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: super-admin update blocked'; end if;
  raise notice 'PASS: active super admin can manage role/status';
end;
$$;

-- A suspended instructor cannot reactivate or promote themselves.
select set_config('request.jwt.claim.sub', 'f1400000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"f1400000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  begin
    update public.profiles set status = 'active', role = 'super_admin'
      where id = 'f1410000-0000-4000-8000-000000000002';
    raise exception 'FAIL: suspended instructor escalated';
  exception when insufficient_privilege then
    raise notice 'PASS: suspended instructor cannot escalate';
  end;
end;
$$;

reset role;
set local role service_role;
-- Keep a non-admin JWT subject: the trusted database role is what matters.
insert into public.profiles (id, full_name, email, role, status)
values ('f1410000-0000-4000-8000-000000000004', 'Provisioned Instructor',
        'profile-guard-provisioned@example.invalid', 'instructor', 'inactive');
-- Exercise the same email-conflict upsert pattern as admin provisioning.
insert into public.profiles (full_name, email, role, status)
values ('Provisioned Student', 'profile-guard-provisioned@example.invalid', 'student', 'active')
on conflict (email) do update set
  full_name = excluded.full_name, role = excluded.role, status = excluded.status;
update public.profiles set auth_user_id = null
  where id = 'f1410000-0000-4000-8000-000000000002';
update public.profiles set auth_user_id = 'f1400000-0000-4000-8000-000000000002'
  where id = 'f1410000-0000-4000-8000-000000000004';

reset role;
do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = 'f1410000-0000-4000-8000-000000000004'
      and role = 'student' and status = 'active'
      and auth_user_id = 'f1400000-0000-4000-8000-000000000002'
  ) then raise exception 'FAIL: service-role provisioning or identity linking failed'; end if;
  if not exists (
    select 1 from public.profiles
    where id = 'f1410000-0000-4000-8000-000000000002'
      and full_name = 'Guard Other' and role = 'instructor' and status = 'suspended'
  ) then raise exception 'FAIL: cross-user or privilege protection failed'; end if;
  raise notice 'PASS: trusted provisioning/upsert/linking preserved';
end;
$$;

rollback;
\echo Profile self-update verification passed; fixtures and grants rolled back.
