-- Trusted-admin object verification replaces mandatory deep media inspection.
-- Forward only; prerequisite: 202610030001. No existing data is promoted.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Resolve PostgreSQL's generated name by its column dependencies. Fail closed
-- on an unexpected schema instead of dropping a guessed constraint.
do $$
declare names text[]; existing_count integer;
begin
  select array_agg(c.conname) into names from pg_constraint c
    where c.conrelid = 'public.lesson_video_assets'::regclass and c.contype = 'c'
      and (select attnum from pg_attribute where attrelid=c.conrelid and attname='state') = any(c.conkey)
      and (select attnum from pg_attribute where attrelid=c.conrelid and attname='video_codec') = any(c.conkey);
  select count(*) into existing_count from pg_constraint where conrelid='public.lesson_video_assets'::regclass and conname='lesson_video_assets_ready_object_check';
  if coalesce(array_length(names,1),0) = 1 and existing_count = 0 then
    execute format('alter table public.lesson_video_assets drop constraint %I', names[1]);
    alter table public.lesson_video_assets add constraint lesson_video_assets_ready_object_check
      check (state <> 'ready' or coalesce(verified_bytes = expected_bytes and object_etag is not null, false));
  elsif coalesce(array_length(names,1),0) <> 0 or existing_count <> 1 then
    raise exception 'Unexpected lesson_video_assets Ready contract; inspect schema before applying';
  end if;
end $$;

create or replace function public.claim_lesson_video_upload(upload_uuid uuid, actor uuid, target_state text, claim_uuid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.lesson_video_uploads; a public.lesson_video_assets; p public.profiles;
begin
  select * into p from public.profiles where id = actor for share;
  if p.id is null or p.role is distinct from 'super_admin' or p.status is distinct from 'active' then raise exception 'Forbidden'; end if;
  if upload_uuid is null or target_state is null or claim_uuid is null then raise exception 'Missing upload claim arguments'; end if;
  select v.* into a from public.lesson_video_assets v join public.lesson_video_uploads s on s.asset_id = v.id where s.id = upload_uuid for update of v;
  select * into u from public.lesson_video_uploads where id = upload_uuid and initiated_by = actor for update;
  if u.id is null or a.id is null or u.asset_id is distinct from a.id or target_state not in ('completing','canceling') then raise exception 'Invalid upload'; end if;
  if a.state in ('deleting','deleted') then raise exception 'Asset is being cleaned up'; end if;
  if target_state = 'canceling' and a.state = 'ready' then raise exception 'Ready asset cannot be canceled'; end if;
  if target_state = 'completing' and (a.retired_at is not null or a.cleanup_after is not null or a.cleanup_claim is not null or a.state not in ('uploading','validating')) then raise exception 'Retired upload cannot complete'; end if;
  if u.operation_until > clock_timestamp() then raise exception 'Upload operation in progress'; end if;
  if target_state = 'completing' and (u.expires_at <= clock_timestamp() or u.state not in ('uploading','completing','validating')) then raise exception 'Upload cannot complete'; end if;
  if target_state = 'canceling' and u.state not in ('initializing','uploading','completing','validating','canceling','failed') then raise exception 'Upload cannot cancel'; end if;
  update public.lesson_video_uploads set state = target_state, operation_token = claim_uuid, operation_until = clock_timestamp() + interval '5 minutes' where id = u.id returning * into u;
  return to_jsonb(u);
end $$;


-- Preserve every attachment/publication guard; accommodate unknown duration.
create or replace function public.guard_lesson_video() returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.lesson_video_assets; course_id uuid;
begin
  if current_setting('role', true) in ('anon','authenticated') then
    if TG_OP = 'INSERT' and new.video_asset_id is not null then raise exception 'Video attachment requires server control'; end if;
    if TG_OP = 'UPDATE' and (new.video_asset_id is distinct from old.video_asset_id or new.video_source is distinct from old.video_source) then raise exception 'Video attachment requires server control'; end if;
  end if;
  if TG_OP = 'INSERT' and new.video_source <> 'r2' then raise exception 'New lessons require R2'; end if;
  if TG_OP = 'UPDATE' and old.video_source = 'r2' and new.video_source <> 'r2' then raise exception 'Legacy source cannot be introduced'; end if;
  if new.video_asset_id is not null then
    -- Share-lock the section before the asset. A concurrent course move must
    -- finish first, or wait and see the attachment in its own guard trigger.
    select s.course_id into course_id from public.course_sections s where s.id = new.section_id for share;
    select * into a from public.lesson_video_assets where id = new.video_asset_id for update;
    if a.id is null or course_id is null or new.lesson_type <> 'video' or a.lesson_id is distinct from new.id or a.original_course_id is distinct from course_id or a.state <> 'ready' or a.retired_at is not null or a.cleanup_after is not null or a.cleanup_claim is not null or a.cleanup_claim_until is not null or a.deleted_at is not null then raise exception 'Video is not ready for this lesson'; end if;
    new.video_source := 'r2';
    -- Asset duration remains unknown; 0 is the existing lesson default.
    new.duration_seconds := coalesce(a.duration_seconds, 0);
  end if;
  if TG_OP = 'UPDATE' and old.video_asset_id is not null and new.video_asset_id is null and new.lesson_type = 'video' and new.status = 'published' then raise exception 'Remove video as Draft'; end if;
  if new.lesson_type = 'video' and new.status = 'published' and new.video_asset_id is null then
    if TG_OP <> 'UPDATE' then raise exception 'A Ready video is required'; end if;
    if old.video_source <> 'legacy_youtube' or new.video_source <> 'legacy_youtube' or old.video_asset_id is not null or
      not (coalesce(new.youtube_video_id ~ '^[A-Za-z0-9_-]{11}$', false) or nullif(btrim(new.mux_playback_id), '') is not null) then raise exception 'A Ready video is required'; end if;
  end if;
  return new;
end $$;

-- Called only after trusted server HEAD verification. PostgreSQL cannot inspect
-- R2: verified_size/etag must come from the server, never browser request data.
create or replace function public.finish_lesson_video_upload(upload_uuid uuid, actor uuid, claim_uuid uuid, verified_size bigint, verified_etag text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.lesson_video_assets; u public.lesson_video_uploads; p public.profiles;
begin
  select * into p from public.profiles where id=actor for share;
  if p.id is null or p.role is distinct from 'super_admin' or p.status is distinct from 'active' then raise exception 'Forbidden'; end if;
  if upload_uuid is null or claim_uuid is null or verified_size is null or nullif(btrim(verified_etag),'') is null then raise exception 'Missing verification arguments'; end if;
  select v.* into a from public.lesson_video_assets v join public.lesson_video_uploads s on s.asset_id=v.id where s.id=upload_uuid for update of v;
  select * into u from public.lesson_video_uploads where id=upload_uuid for update;
  if u.id is null or a.id is null or u.initiated_by is distinct from actor or u.state <> 'completing' or u.multipart_id is null or u.operation_token is distinct from claim_uuid or u.operation_until is null or u.operation_until <= clock_timestamp() or u.expires_at <= clock_timestamp() then raise exception 'Upload claim unavailable'; end if;
  if a.state not in ('uploading','validating') or a.lesson_id is null or a.retired_at is not null or a.cleanup_after is not null or a.cleanup_claim is not null or a.deleted_at is not null or verified_size <> a.expected_bytes or verified_size not between 1 and 1000000000 then raise exception 'Asset unavailable or mismatched'; end if;
  if a.state='validating' and (a.verified_bytes is distinct from verified_size or a.object_etag is distinct from verified_etag) then raise exception 'Completed object changed'; end if;
  update public.lesson_video_assets set state='ready', verified_bytes=verified_size, object_etag=verified_etag, failure_code=null where id=a.id;
  -- Preserve the existing terminal upload state for attachment/cleanup callers.
  update public.lesson_video_uploads set state='validating', completed_at=coalesce(completed_at,now()), operation_token=null, operation_until=null where id=u.id;
end $$;
revoke all on function public.finish_lesson_video_upload(uuid,uuid,uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.finish_lesson_video_upload(uuid,uuid,uuid,bigint,text) to service_role;
commit;
