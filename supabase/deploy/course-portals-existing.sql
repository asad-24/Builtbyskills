-- One-time course portal update for the EXISTING Builtbyskills database.
-- Project: tnnkslgihwofhvigfzef
-- Run the whole file in that project's Supabase SQL Editor before deploying the new app.
-- Deployment copy of supabase/migrations/202610240001_course_portals.sql; existing student/course/payment records are retained.
-- The explicit transaction rolls back the whole update if any statement fails.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Additive portal migration. Existing lessons, videos and payment records stay intact.
create table public.course_recordings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null check (length(btrim(title)) between 3 and 200),
  description text,
  recording_url text not null check (recording_url ~* '^https?://[^/@[:space:]]+([/?#]|$)' and recording_url !~ '[[:space:]]'),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_recordings_course_idx on public.course_recordings(course_id, created_at desc);
create trigger course_recordings_touch_updated_at before update on public.course_recordings
  for each row execute function public.touch_updated_at();
alter table public.course_recordings enable row level security;
grant select, insert, update, delete on public.course_recordings to authenticated;
grant all on public.course_recordings to service_role;

create policy recordings_read on public.course_recordings for select to authenticated using (
  public.is_super_admin() or public.is_instructor_for_course(course_id)
  or (is_published and public.has_active_enrollment(course_id)
    and exists(select 1 from public.courses c where c.id = course_id and c.status = 'published'))
);
create policy recordings_insert on public.course_recordings for insert to authenticated with check (
  public.is_super_admin() or (public.is_instructor_for_course(course_id) and author_id = public.current_profile_id())
);
create policy recordings_update on public.course_recordings for update to authenticated
  using(public.is_super_admin() or public.is_instructor_for_course(course_id))
  with check(public.is_super_admin() or public.is_instructor_for_course(course_id));
create policy recordings_delete on public.course_recordings for delete to authenticated
  using(public.is_super_admin() or public.is_instructor_for_course(course_id));

-- Do not let a teacher relabel content as belonging to another teacher/course.
create function public.guard_course_link_identity() returns trigger language plpgsql
set search_path = pg_catalog as $$
begin
  if not public.is_super_admin() and current_user not in ('postgres','service_role','supabase_admin') then
    if new.course_id is distinct from old.course_id or new.id is distinct from old.id then
      raise exception 'A course link cannot be moved to another course.' using errcode = '42501';
    end if;
    if tg_table_name = 'course_recordings' then
      if new.author_id is distinct from old.author_id then
        raise exception 'The link author cannot be changed.' using errcode = '42501';
      end if;
    elsif new.instructor_id is distinct from old.instructor_id then
      raise exception 'The class instructor cannot be changed.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger recordings_guard_identity before update on public.course_recordings
  for each row execute function public.guard_course_link_identity();
create trigger live_classes_guard_identity before update on public.live_classes
  for each row execute function public.guard_course_link_identity();

-- Preserve legacy rows, while requiring safe links and sane dates on future writes.
alter table public.live_classes add constraint live_classes_safe_meeting_url
  check (meeting_url ~* '^https?://[^/@[:space:]]+([/?#]|$)' and meeting_url !~ '[[:space:]]') not valid;
alter table public.live_classes add constraint live_classes_time_window
  check (ends_at is null or ends_at > starts_at) not valid;

-- FOR ALL policies also authorize SELECT: split the old policy into write-only policies.
drop policy if exists live_classes_admin_instructor_write on public.live_classes;
drop policy if exists live_classes_authorized_read on public.live_classes;
create policy live_classes_authorized_read on public.live_classes for select to authenticated using (
  public.is_super_admin() or public.is_instructor_for_course(course_id)
  or (status in ('scheduled','live') and public.has_active_enrollment(course_id)
    and exists(select 1 from public.courses c where c.id = course_id and c.status = 'published'))
);
create policy live_classes_insert on public.live_classes for insert to authenticated with check (
  public.is_super_admin() or (public.is_instructor_for_course(course_id) and instructor_id = public.current_profile_id())
);
create policy live_classes_update on public.live_classes for update to authenticated
  using(public.is_super_admin() or public.is_instructor_for_course(course_id))
  with check(public.is_super_admin() or public.is_instructor_for_course(course_id));
create policy live_classes_delete on public.live_classes for delete to authenticated
  using(public.is_super_admin() or public.is_instructor_for_course(course_id));

-- Keep primary instructor assignment compatible with existing course editor.
insert into public.instructor_courses(instructor_id,course_id)
select c.instructor_id,c.id from public.courses c join public.profiles p on p.id=c.instructor_id
where p.role='instructor' on conflict(instructor_id,course_id) do nothing;
create function public.sync_primary_course_instructor() returns trigger language plpgsql security definer
set search_path = pg_catalog as $$
begin
  if tg_op = 'UPDATE' and old.instructor_id is distinct from new.instructor_id then
    delete from public.instructor_courses where course_id=new.id and instructor_id=old.instructor_id;
  end if;
  if new.instructor_id is not null then
    if not exists(select 1 from public.profiles where id=new.instructor_id and role='instructor') then
      raise exception 'Select an instructor profile.' using errcode='23514';
    end if;
    insert into public.instructor_courses(instructor_id,course_id) values(new.instructor_id,new.id)
      on conflict(instructor_id,course_id) do nothing;
  end if;
  return new;
end $$;
create trigger courses_sync_instructor after insert or update of instructor_id on public.courses
  for each row execute function public.sync_primary_course_instructor();

-- Assignment/revocation and primary-pointer cleanup are atomic and role checked.
create function public.manage_course_instructor(p_course_id uuid,p_instructor_id uuid,p_assigned boolean)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  perform 1 from public.courses where id=p_course_id for update;
  if not found then raise exception 'Course not found.'; end if;
  perform 1 from public.profiles where id=p_instructor_id and role='instructor'
    and (not p_assigned or status='active') for share;
  if not found then raise exception 'Select an active instructor.'; end if;
  if p_assigned then
    insert into public.instructor_courses(instructor_id,course_id,assigned_by)
      values(p_instructor_id,p_course_id,public.current_profile_id())
      on conflict(instructor_id,course_id) do nothing;
  else
    update public.courses set instructor_id=null where id=p_course_id and instructor_id=p_instructor_id;
    delete from public.instructor_courses where course_id=p_course_id and instructor_id=p_instructor_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(public.current_profile_id(),case when p_assigned then 'instructor.assigned' else 'instructor.unassigned' end,
      'course',p_course_id,jsonb_build_object('instructor_id',p_instructor_id));
end $$;
revoke all on function public.manage_course_instructor(uuid,uuid,boolean) from public,anon;
grant execute on function public.manage_course_instructor(uuid,uuid,boolean) to authenticated;

create function public.guard_enrollment_participants() returns trigger language plpgsql security definer
set search_path=pg_catalog as $$
begin
  if not exists(select 1 from public.profiles where id=new.student_id and role='student') then
    raise exception 'Only student profiles can be enrolled.' using errcode='23514';
  end if;
  if new.starts_at is not null and new.expires_at is not null and new.expires_at <= new.starts_at then
    raise exception 'Expiry must be after the start date.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger enrollments_guard_participants before insert or update on public.enrollments
  for each row execute function public.guard_enrollment_participants();

-- Registration never accepts a role from user-controlled metadata. Run only
-- after email verification; link existing unclaimed STUDENT records safely.
create function public.ensure_student_profile() returns uuid language plpgsql security definer
set search_path=pg_catalog as $$
declare
  u auth.users%rowtype;
  p public.profiles%rowtype;
begin
  select * into u from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until <= now());
  if not found then raise exception 'Verify your email before continuing.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(u.email),0));
  select * into p from public.profiles where auth_user_id=u.id;
  if found then return p.id; end if;
  if (select count(*) from public.profiles where lower(email)=lower(u.email)) > 1 then
    raise exception 'Contact the academy to resolve this account.' using errcode='42501';
  end if;
  select * into p from public.profiles where lower(email)=lower(u.email) for update;
  if found then
    if p.role <> 'student' or p.auth_user_id is not null or p.status <> 'active' then
      raise exception 'Contact the academy to resolve this account.' using errcode='42501';
    end if;
    update public.profiles set auth_user_id=u.id where id=p.id;
    return p.id;
  end if;
  insert into public.profiles(auth_user_id,email,full_name,phone,role,status)
    values(u.id,lower(u.email),coalesce(nullif(left(btrim(u.raw_user_meta_data->>'full_name'),200),''),'Student'),
      left(u.raw_user_meta_data->>'phone',50),'student','active') returning id into p.id;
  return p.id;
end $$;
revoke all on function public.ensure_student_profile() from public,anon;
grant execute on function public.ensure_student_profile() to authenticated;

notify pgrst, 'reload schema';

commit;
