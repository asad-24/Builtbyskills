-- Additive only. Manually apply after the existing LMS/YouTube security migrations.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.lesson_video_assets (
  id uuid primary key,
  lesson_id uuid references public.lessons(id) on delete set null,
  original_lesson_id uuid not null,
  original_course_id uuid not null,
  object_key text not null unique,
  original_name text not null check (length(original_name) between 1 and 200),
  state text not null default 'uploading' check (state in ('uploading','validating','ready','failed','deleting','deleted')),
  expected_bytes bigint not null check (expected_bytes between 1 and 1000000000),
  verified_bytes bigint check (verified_bytes between 1 and 1000000000),
  object_etag text,
  container text,
  video_codec text,
  audio_codec text,
  pixel_format text,
  fast_start boolean,
  duration_seconds integer check (duration_seconds between 1 and 86400),
  validated_at timestamptz,
  validation_version text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  cleanup_after timestamptz,
  cleanup_claim uuid,
  cleanup_claim_until timestamptz,
  deleted_at timestamptz,
  failure_code text,
  check (object_key = 'courses/' || original_course_id::text || '/lessons/' || original_lesson_id::text || '/videos/' || id::text || '/source.mp4'),
  check (state <> 'ready' or coalesce((verified_bytes = expected_bytes and object_etag is not null and container = 'mp4' and video_codec = 'h264' and (audio_codec is null or audio_codec = 'aac') and pixel_format = 'yuv420p' and fast_start = true and duration_seconds is not null and validated_at is not null and validation_version is not null), false))
);
create table public.lesson_video_uploads (
  id uuid primary key,
  asset_id uuid not null unique references public.lesson_video_assets(id),
  initiated_by uuid references public.profiles(id) on delete set null,
  expected_updated_at timestamptz not null,
  multipart_id text,
  state text not null default 'initializing' check (state in ('initializing','uploading','completing','validating','canceling','canceled','failed')),
  expires_at timestamptz not null default now() + interval '24 hours',
  operation_token uuid,
  operation_until timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_code text
);
alter table public.lessons add column video_asset_id uuid references public.lesson_video_assets(id);
-- PostgreSQL's constant missing-value default marks pre-existing rows without
-- UPDATE, table rewrite, or updated_at triggers. The legacy marker also covers
-- historical Mux lessons; no existing video identifiers or statuses change.
alter table public.lessons add column video_source text not null default 'legacy_youtube' check (video_source in ('r2','legacy_youtube'));
alter table public.lessons alter column video_source set default 'r2';

alter table public.lesson_video_assets enable row level security;
alter table public.lesson_video_uploads enable row level security;
revoke all on public.lesson_video_assets, public.lesson_video_uploads from public, anon, authenticated;
grant all on public.lesson_video_assets, public.lesson_video_uploads to service_role;
create index lesson_video_assets_cleanup_idx on public.lesson_video_assets(cleanup_after) where state <> 'deleted';
create index lesson_video_uploads_expiry_idx on public.lesson_video_uploads(expires_at);
create index lessons_video_asset_id_idx on public.lessons(video_asset_id) where video_asset_id is not null;
create index lesson_video_assets_lesson_id_idx on public.lesson_video_assets(lesson_id) where lesson_id is not null;
-- AFTER DELETE finds tombstones even when the FK has already cleared lesson_id.
create index lesson_video_assets_original_lesson_id_idx on public.lesson_video_assets(original_lesson_id);

create function public.guard_immutable_video_asset() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lesson_id is distinct from old.lesson_id and new.lesson_id is not null then raise exception 'Video lesson binding is immutable'; end if;
  -- Only an actual lesson deletion may clear the binding (ON DELETE SET NULL).
  if old.lesson_id is not null and new.lesson_id is null and exists(select 1 from public.lessons where id = old.lesson_id) then raise exception 'Video lesson binding cannot be cleared'; end if;
  -- The asset row lock serializes this check against attachment's asset lock.
  if exists(select 1 from public.lessons where video_asset_id = old.id) and
    (new.lesson_id is distinct from old.lesson_id or new.state <> 'ready' or new.retired_at is not null or new.cleanup_after is not null or new.cleanup_claim is not null or new.cleanup_claim_until is not null or new.deleted_at is not null) then
    raise exception 'Referenced video must remain ready and bound';
  end if;
  if row(new.id,new.original_lesson_id,new.original_course_id,new.object_key,new.expected_bytes,new.uploaded_by,new.created_at) is distinct from row(old.id,old.original_lesson_id,old.original_course_id,old.object_key,old.expected_bytes,old.uploaded_by,old.created_at) then
    -- FK profile deletion may null uploaded_by; preserve identity otherwise.
    if not (new.uploaded_by is null and old.uploaded_by is not null and row(new.id,new.original_lesson_id,new.original_course_id,new.object_key,new.expected_bytes,new.created_at) is not distinct from row(old.id,old.original_lesson_id,old.original_course_id,old.object_key,old.expected_bytes,old.created_at)) then raise exception 'Video identity is immutable'; end if;
  end if;
  if old.validated_at is not null and row(new.verified_bytes,new.object_etag,new.container,new.video_codec,new.audio_codec,new.pixel_format,new.fast_start,new.duration_seconds,new.validated_at,new.validation_version) is distinct from row(old.verified_bytes,old.object_etag,old.container,old.video_codec,old.audio_codec,old.pixel_format,old.fast_start,old.duration_seconds,old.validated_at,old.validation_version) then raise exception 'Validated media is immutable'; end if;
  return new;
end $$;
create trigger guard_immutable_video_asset before update on public.lesson_video_assets for each row execute function public.guard_immutable_video_asset();

create function public.guard_lesson_video() returns trigger language plpgsql security definer set search_path = '' as $$
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
    new.duration_seconds := a.duration_seconds;
  end if;
  if TG_OP = 'UPDATE' and old.video_asset_id is not null and new.video_asset_id is null and new.lesson_type = 'video' and new.status = 'published' then raise exception 'Remove video as Draft'; end if;
  if new.lesson_type = 'video' and new.status = 'published' and new.video_asset_id is null then
    if TG_OP <> 'UPDATE' then raise exception 'A Ready video is required'; end if;
    if old.video_source <> 'legacy_youtube' or new.video_source <> 'legacy_youtube' or old.video_asset_id is not null or
      not (coalesce(new.youtube_video_id ~ '^[A-Za-z0-9_-]{11}$', false) or nullif(btrim(new.mux_playback_id), '') is not null) then raise exception 'A Ready video is required'; end if;
  end if;
  return new;
end $$;
create trigger guard_lesson_video before insert or update on public.lessons for each row execute function public.guard_lesson_video();

create function public.guard_section_video_course() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.course_id is distinct from old.course_id and exists (
    select 1 from public.lessons l where l.section_id = old.id and l.video_asset_id is not null
  ) then raise exception 'Detach R2 videos before moving this section to another course'; end if;
  return new;
end $$;
create trigger guard_section_video_course before update of course_id on public.course_sections for each row execute function public.guard_section_video_course();

create function public.retire_lesson_video() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    update public.lesson_video_assets set retired_at = coalesce(retired_at, now()), cleanup_after = coalesce(cleanup_after, now() + interval '7 days') where original_lesson_id = old.id and state <> 'deleted';
    return old;
  end if;
  if old.video_asset_id is distinct from new.video_asset_id and old.video_asset_id is not null then
    update public.lesson_video_assets set retired_at = now(), cleanup_after = now() + interval '7 days' where id = old.video_asset_id;
  end if;
  return new;
end $$;
create trigger retire_lesson_video after update of video_asset_id on public.lessons for each row execute function public.retire_lesson_video();
-- AFTER DELETE: reference protection must see the lesson already gone. The FK
-- can clear lesson_id before or after this trigger; original_lesson_id survives.
create trigger delete_lesson_video after delete on public.lessons for each row execute function public.retire_lesson_video();

create function public.reserve_lesson_video(target_lesson uuid, actor uuid, expected_version timestamptz, asset_uuid uuid, upload_uuid uuid, file_name text, file_bytes bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.lessons; c uuid; result jsonb; p public.profiles;
begin
  -- Serialize quota reservations and authorize the locked row, never a prior read.
  select * into p from public.profiles where id = actor for update;
  if p.id is null or p.role is distinct from 'super_admin' or p.status is distinct from 'active' then raise exception 'Forbidden'; end if;
  if target_lesson is null or expected_version is null or asset_uuid is null or upload_uuid is null or file_name is null or file_bytes is null then raise exception 'Missing upload arguments'; end if;
  if length(file_name) not between 1 and 200 or file_bytes not between 1 and 1000000000 then raise exception 'Invalid upload arguments'; end if;
  if (select count(*) from public.lesson_video_uploads where initiated_by = actor and state in ('initializing','uploading','completing') and expires_at > now()) >= 3 then raise exception 'Upload quota reached'; end if;
  select * into l from public.lessons where id = target_lesson for update;
  if l.id is null or l.lesson_type <> 'video' or l.updated_at is distinct from expected_version then raise exception 'Lesson changed'; end if;
  select course_id into c from public.course_sections where id = l.section_id for share;
  if c is null then raise exception 'Lesson section unavailable'; end if;
  insert into public.lesson_video_assets(id, lesson_id, original_lesson_id, original_course_id, object_key, original_name, expected_bytes, uploaded_by)
    values(asset_uuid, l.id, l.id, c, 'courses/' || c::text || '/lessons/' || l.id::text || '/videos/' || asset_uuid::text || '/source.mp4', file_name, file_bytes, actor);
  insert into public.lesson_video_uploads(id, asset_id, initiated_by, expected_updated_at) values(upload_uuid, asset_uuid, actor, expected_version);
  select to_jsonb(u) into result from public.lesson_video_uploads u where id = upload_uuid;
  return result;
end $$;

create function public.claim_lesson_video_upload(upload_uuid uuid, actor uuid, target_state text, claim_uuid uuid)
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
  if target_state = 'completing' and a.retired_at is not null then raise exception 'Retired upload cannot complete'; end if;
  if u.operation_until > clock_timestamp() then raise exception 'Upload operation in progress'; end if;
  if target_state = 'completing' and (u.expires_at <= clock_timestamp() or u.state not in ('uploading','completing')) then raise exception 'Upload cannot complete'; end if;
  if target_state = 'canceling' and u.state not in ('initializing','uploading','completing','validating','canceling','failed') then raise exception 'Upload cannot cancel'; end if;
  update public.lesson_video_uploads set state = target_state, operation_token = claim_uuid, operation_until = clock_timestamp() + interval '5 minutes' where id = u.id returning * into u;
  return to_jsonb(u);
end $$;

create function public.attach_lesson_video(target_lesson uuid, target_asset uuid, actor uuid, expected_version timestamptz)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare l public.lessons; p public.profiles;
begin
  select * into p from public.profiles where id = actor for share;
  if p.id is null or p.role is distinct from 'super_admin' or p.status is distinct from 'active' then raise exception 'Forbidden'; end if;
  if target_lesson is null or target_asset is null or expected_version is null then raise exception 'Missing attachment arguments'; end if;
  select * into l from public.lessons where id = target_lesson for update;
  if l.id is null then raise exception 'Lesson unavailable'; end if;
  -- Idempotent retry must not bypass a later removal/replacement.
  if l.video_asset_id = target_asset then return l.updated_at; end if;
  if l.updated_at is distinct from expected_version or l.lesson_type <> 'video' then raise exception 'Lesson changed'; end if;
  update public.lessons set video_asset_id = target_asset, video_source = 'r2' where id = target_lesson returning * into l;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values(actor, 'lesson.video_attached', 'lesson', l.id);
  return l.updated_at;
end $$;
create function public.remove_lesson_video(target_lesson uuid, actor uuid, expected_version timestamptz)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare l public.lessons; p public.profiles;
begin
  select * into p from public.profiles where id = actor for share;
  if p.id is null or p.role is distinct from 'super_admin' or p.status is distinct from 'active' then raise exception 'Forbidden'; end if;
  if target_lesson is null or expected_version is null then raise exception 'Missing removal arguments'; end if;
  select * into l from public.lessons where id = target_lesson for update;
  if l.id is null then raise exception 'Lesson unavailable'; end if;
  if l.updated_at is distinct from expected_version then raise exception 'Lesson changed'; end if;
  update public.lessons set video_asset_id = null, video_source = 'r2', status = case when lesson_type = 'video' and status = 'published' then 'draft'::public.lesson_status else status end where id = target_lesson returning * into l;
  -- Historical youtube/mux columns deliberately retained, but never selected as fallback after removal.
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values(actor, 'lesson.video_removed', 'lesson', l.id);
  return l.updated_at;
end $$;

-- Only a trusted OFFLINE validator may call this; no HTTP endpoint accepts media claims.
create function public.validate_lesson_video(target_asset uuid, expected_etag text, media jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.lesson_video_uploads;
begin
  if target_asset is null or expected_etag is null or media is null then raise exception 'Missing validation arguments'; end if;
  perform 1 from public.lesson_video_assets where id = target_asset for update;
  select * into u from public.lesson_video_uploads where asset_id = target_asset for update;
  if u.id is null or u.state <> 'validating' or u.operation_token is not null then raise exception 'Upload is not awaiting validation'; end if;
  update public.lesson_video_assets set state = 'ready', container = media->>'container', video_codec = media->>'video_codec', audio_codec = media->>'audio_codec', pixel_format = media->>'pixel_format', fast_start = (media->>'fast_start')::boolean, duration_seconds = (media->>'duration_seconds')::integer, validation_version = media->>'validation_version', validated_at = now(), failure_code = null
    where id = target_asset and state = 'validating' and object_etag = expected_etag and retired_at is null and cleanup_after is null;
  if not found then raise exception 'Asset unavailable or changed'; end if;
end $$;

create function public.claim_lesson_video_cleanup(target_asset uuid, claim_uuid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.lesson_video_assets; u public.lesson_video_uploads;
begin
  if target_asset is null or claim_uuid is null then raise exception 'Missing cleanup claim arguments'; end if;
  select * into a from public.lesson_video_assets where id = target_asset for update;
  select * into u from public.lesson_video_uploads where asset_id = a.id for update;
  if a.id is null or u.id is null or a.state = 'deleted' or a.cleanup_after is null or a.cleanup_after > clock_timestamp() or a.cleanup_claim_until > clock_timestamp() or exists(select 1 from public.lessons where video_asset_id = a.id) or u.operation_until > clock_timestamp() then return null; end if;
  update public.lesson_video_assets set state = 'deleting', cleanup_claim = claim_uuid, cleanup_claim_until = clock_timestamp() + interval '5 minutes' where id = a.id returning * into a;
  return to_jsonb(a);
end $$;

create function public.retire_expired_lesson_videos() returns void language plpgsql security definer set search_path = '' as $$
declare a public.lesson_video_assets; u public.lesson_video_uploads;
begin
  for a in select v.* from public.lesson_video_assets v join public.lesson_video_uploads s on s.asset_id = v.id
    where s.expires_at <= clock_timestamp() and v.cleanup_after is null and v.retired_at is null and v.state not in ('deleting','deleted') and (s.operation_until is null or s.operation_until <= clock_timestamp())
      and not exists(select 1 from public.lessons l where l.video_asset_id = v.id)
    order by s.expires_at limit 10 for update of v skip locked
  loop
    -- Asset -> upload is the same order as completion/validation/cleanup.
    -- The candidate scan is only a hint: reread both locked records and every
    -- eligibility condition after any wait, using current wall-clock deadlines.
    select * into u from public.lesson_video_uploads where asset_id = a.id for update;
    select * into a from public.lesson_video_assets where id = a.id for update;
    if u.id is not null and u.asset_id = a.id and u.expires_at <= clock_timestamp() and (u.operation_until is null or u.operation_until <= clock_timestamp())
      and u.state in ('initializing','uploading','completing','validating','canceling','canceled','failed')
      and a.cleanup_after is null and a.retired_at is null and a.state not in ('deleting','deleted')
      and not exists(select 1 from public.lessons where video_asset_id = a.id) then
      update public.lesson_video_assets set retired_at = now(), cleanup_after = case when state = 'ready' then now() + interval '7 days' else now() end, failure_code = 'unattached_upload_expired' where id = a.id;
    end if;
  end loop;
end $$;

create or replace function public.can_access_published_lesson(target_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.lessons l join public.course_sections s on s.id = l.section_id join public.courses c on c.id = s.course_id
    where l.id = target_lesson_id and l.status = 'published' and c.status = 'published' and public.has_active_enrollment(c.id))
$$;
-- Preserve existing section-metadata access; lesson/video access stays private.
drop policy if exists sections_authorized_read on public.course_sections;
create policy sections_authorized_read on public.course_sections for select using (
  public.is_super_admin() or public.is_instructor_for_course(course_id)
  or public.has_active_enrollment(course_id)
  or exists(select 1 from public.courses c where c.id = course_id and c.status = 'published')
);
-- Completion remains sticky even across concurrent tabs/upserts.
create function public.preserve_lesson_completion() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.is_completed then new.is_completed := true; new.completed_at := coalesce(old.completed_at,new.completed_at,now()); new.completion_percentage := 100; end if;
  return new;
end $$;
create trigger preserve_lesson_completion before update on public.lesson_progress for each row execute function public.preserve_lesson_completion();

-- Functions are never callable by browser roles, including security-definer validators.
revoke all on function public.guard_immutable_video_asset(), public.guard_lesson_video(), public.guard_section_video_course(), public.retire_lesson_video(), public.reserve_lesson_video(uuid,uuid,timestamptz,uuid,uuid,text,bigint), public.claim_lesson_video_upload(uuid,uuid,text,uuid), public.attach_lesson_video(uuid,uuid,uuid,timestamptz), public.remove_lesson_video(uuid,uuid,timestamptz), public.validate_lesson_video(uuid,text,jsonb), public.claim_lesson_video_cleanup(uuid,uuid), public.retire_expired_lesson_videos(), public.preserve_lesson_completion() from public, anon, authenticated;
grant execute on function public.reserve_lesson_video(uuid,uuid,timestamptz,uuid,uuid,text,bigint), public.claim_lesson_video_upload(uuid,uuid,text,uuid), public.attach_lesson_video(uuid,uuid,uuid,timestamptz), public.remove_lesson_video(uuid,uuid,timestamptz), public.validate_lesson_video(uuid,text,jsonb), public.claim_lesson_video_cleanup(uuid,uuid), public.retire_expired_lesson_videos() to service_role;
commit;
