-- RLS determines which rows may be updated. This trigger additionally protects
-- identity/authorization fields even when authenticated has table UPDATE grants.
create function public.guard_profile_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  -- Check the actual database role, not editable user metadata. Keep this
  -- function SECURITY INVOKER: a definer would hide the calling database role.
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or (current_user = 'authenticated' and public.is_super_admin()) then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity and security fields require administrator access.'
      using errcode = '42501';
  end if;

  -- full_name, phone, whatsapp and avatar_url remain self-editable under RLS.
  -- The existing profiles_touch_updated_at trigger owns updated_at.
  return new;
end;
$$;

revoke all on function public.guard_profile_security_fields() from public;

create trigger profiles_guard_security_fields
before update on public.profiles
for each row execute function public.guard_profile_security_fields();
