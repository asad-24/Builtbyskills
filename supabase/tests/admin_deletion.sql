-- Run after migrations against an isolated Supabase test database. Always rolls back.
\set ON_ERROR_STOP on
begin;
do $$
declare
  admin_id uuid := gen_random_uuid(); method_id uuid := gen_random_uuid();
  course_id uuid := gen_random_uuid(); payment_id uuid := gen_random_uuid();
  null_payment_id uuid := gen_random_uuid();
  version timestamptz; deleted boolean;
begin
  insert into public.profiles(id, full_name, email, role, status)
    values(admin_id, 'Delete test admin', admin_id::text || '@example.test', 'super_admin', 'active');
  insert into public.payment_methods(id, method_type, display_name, account_title, account_number)
    values(method_id, 'bank_transfer', 'Test bank', 'Test title', '123456');
  select updated_at into version from public.payment_methods where id = method_id;
  if public.delete_unreferenced_payment_method(method_id, version - interval '1 second', admin_id) then
    raise exception 'Stale delete succeeded';
  end if;
  insert into public.courses(id, title, slug, short_description, description, category, level, price, currency)
    values(course_id, 'Test course', course_id::text, 'Test summary', 'Test description', 'Test', 'All', 100, 'PKR');
  insert into public.payment_submissions(id, course_id, payment_method_id, amount, currency)
    values(payment_id, course_id, method_id, 100, 'PKR');
  insert into public.payment_submissions(id, course_id, payment_method_id, amount, currency)
    values(null_payment_id, course_id, null, 100, 'PKR');
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payment_submissions'::regclass
      and confrelid = 'public.payment_methods'::regclass
      and conname = 'payment_submissions_payment_method_id_fkey'
      and contype = 'f' and confdeltype = 'r' and convalidated and not condeferrable) then
    raise exception 'Expected validated, immediate RESTRICT FK';
  end if;
  begin
    perform public.delete_unreferenced_payment_method(method_id, version, admin_id);
    raise exception 'Referenced delete succeeded';
  exception when foreign_key_violation then null;
  end;
  begin
    delete from public.payment_methods where id = method_id;
    raise exception 'Direct referenced delete succeeded';
  exception when foreign_key_violation then null;
  end;
  if exists(select 1 from public.audit_logs where entity_id = method_id) then
    raise exception 'Failed deletion wrote an audit record';
  end if;
  if not exists(select 1 from public.payment_submissions where id = payment_id and payment_method_id = method_id)
    or not exists(select 1 from public.payment_methods where id = method_id) then
    raise exception 'History was modified';
  end if;
  delete from public.payment_submissions where id = payment_id;
  deleted := public.delete_unreferenced_payment_method(method_id, version, admin_id);
  if not deleted then raise exception 'Unreferenced deletion failed'; end if;
  if not exists(select 1 from public.payment_submissions where id = null_payment_id and payment_method_id is null) then
    raise exception 'Historical NULL payment reference was modified';
  end if;
  if (select count(*) from public.audit_logs where entity_id = method_id
    and actor_id = admin_id and action = 'payment_method.deleted') <> 1 then
    raise exception 'Successful deletion must write exactly one audit record';
  end if;
  begin
    insert into public.payment_submissions(course_id, payment_method_id, amount, currency)
      values(course_id, method_id, 100, 'PKR');
    raise exception 'Missing payment method reference accepted';
  exception when foreign_key_violation then null;
  end;
  if public.delete_unreferenced_payment_method(method_id, version, admin_id) then raise exception 'Replay succeeded'; end if;
  if has_function_privilege('authenticated', 'public.delete_unreferenced_payment_method(uuid,timestamptz,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.delete_unreferenced_payment_method(uuid,timestamptz,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.delete_unreferenced_payment_method(uuid,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'RPC exposed to unauthorized callers';
  end if;
  update public.profiles set status = 'inactive' where id = admin_id;
  begin
    perform public.delete_unreferenced_payment_method(method_id, version, admin_id);
    raise exception 'Inactive admin allowed';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set status = 'suspended' where id = admin_id;
  begin
    perform public.delete_unreferenced_payment_method(method_id, version, admin_id);
    raise exception 'Suspended admin allowed';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set status = 'active', role = 'student' where id = admin_id;
  begin
    perform public.delete_unreferenced_payment_method(method_id, version, admin_id);
    raise exception 'Demoted admin allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_unreferenced_payment_method(method_id, version, gen_random_uuid());
    raise exception 'Missing admin allowed';
  exception when insufficient_privilege then null;
  end;
  if not exists(select 1 from pg_catalog.pg_proc
    where oid = 'public.delete_unreferenced_payment_method(uuid,timestamptz,uuid)'::regprocedure
      and prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'SECURITY DEFINER or empty search_path protection missing';
  end if;
end $$;
rollback;
