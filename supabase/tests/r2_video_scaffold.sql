-- LOCAL DISPOSABLE TEST FIXTURE ONLY. Never apply this file to Supabase.
-- Minimal prerequisite schema matching the relevant LMS tables. Real-schema
-- staging rehearsal is still required; this is not a complete Supabase emulator.
create role anon;
create role authenticated;
create role service_role bypassrls;
create type public.lesson_status as enum ('draft','published','archived');
create type public.lesson_type as enum ('video','text','pdf_resource','external_resource','live_class');
create table public.profiles(id uuid primary key, role text, status text);
create table public.courses(id uuid primary key, status text not null);
create table public.course_sections(id uuid primary key, course_id uuid references public.courses(id) on delete cascade);
create table public.lessons(id uuid primary key, section_id uuid references public.course_sections(id) on delete cascade,
  lesson_type public.lesson_type default 'video', status public.lesson_status default 'draft', updated_at timestamptz default now(),
  youtube_video_id text, mux_upload_id text, mux_asset_id text, mux_playback_id text, duration_seconds integer not null default 0 check (duration_seconds >= 0));
create table public.enrollments(id uuid primary key, student_id uuid references public.profiles(id), course_id uuid references public.courses(id) on delete cascade,
  status text, starts_at timestamptz, expires_at timestamptz);
create table public.lesson_progress(id uuid primary key, lesson_id uuid references public.lessons(id) on delete cascade, student_id uuid,
  enrollment_id uuid references public.enrollments(id) on delete cascade, progress_seconds integer default 0, is_completed boolean default false, completed_at timestamptz, completion_percentage integer default 0);
create table public.audit_logs(actor_id uuid, action text, entity_type text, entity_id uuid);
create function public.touch_test_lesson() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger set_updated_at before update on public.lessons for each row execute function public.touch_test_lesson();
create function public.is_super_admin() returns boolean language sql stable as $$ select false $$;
create function public.is_instructor_for_course(uuid) returns boolean language sql stable as $$ select false $$;
create function public.has_active_enrollment(target_course_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.enrollments e join public.profiles p on p.id=e.student_id where e.course_id=target_course_id
    and p.id=nullif(current_setting('test.student',true),'')::uuid and p.role='student' and p.status='active'
    and e.status='active' and (e.starts_at is null or e.starts_at<=now()) and (e.expires_at is null or e.expires_at>now()))
$$;
insert into public.profiles values('00000000-0000-4000-8000-000000000001','super_admin','active'),('00000000-0000-4000-8000-000000000002','student','active'),('00000000-0000-4000-8000-000000000003','super_admin','inactive');
insert into public.courses values('00000000-0000-4000-8000-000000000004','published');
insert into public.course_sections values('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000004');
insert into public.lessons(id,section_id,status,youtube_video_id,mux_playback_id) values('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000005','published','dQw4w9WgXcQ','historical-mux');
alter table public.lessons enable row level security;
create policy fixture_lesson_write on public.lessons for all using (true) with check(true);
grant select, update on public.lessons to authenticated;
