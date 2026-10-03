begin;

-- Fail promptly rather than queue production traffic behind waiting DDL.
set local lock_timeout = '5s';

-- Replace and validate the FK atomically. ALTER TABLE locks are held until commit:
-- no concurrent write can observe a gap in enforcement. No data is rewritten;
-- historical NULLs and valid references are preserved. Validation fails closed
-- if unexpected orphan references exist. Schedule for a low-traffic window.
alter table public.payment_submissions drop constraint payment_submissions_payment_method_id_fkey;
alter table public.payment_submissions add constraint payment_submissions_payment_method_id_fkey
  foreign key (payment_method_id) references public.payment_methods(id) on delete restrict;

-- Only the server's service role can invoke this operation. Audit and delete commit together.
create or replace function public.delete_unreferenced_payment_method(
  target_id uuid, expected_updated_at timestamptz, actor_profile_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Match payment approval: prevent suspension/demotion until transaction end,
  -- and recheck eligibility after waiting for a concurrent profile update.
  perform 1 from public.profiles
    where id = actor_profile_id and role = 'super_admin' and status = 'active' for share;
  if not found then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;
  delete from public.payment_methods where id = target_id and updated_at = expected_updated_at;
  if not found then return false; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
    values(actor_profile_id, 'payment_method.deleted', 'payment_method', target_id);
  return true;
end;
$$;
revoke all on function public.delete_unreferenced_payment_method(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.delete_unreferenced_payment_method(uuid, timestamptz, uuid) to service_role;

commit;
