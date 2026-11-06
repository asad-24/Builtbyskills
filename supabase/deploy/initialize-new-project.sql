-- New project initialization: ajvtvbpqywxxclmdtnkr
-- Run this COMPLETE file once in that project's Supabase SQL Editor.
-- Generated from the repository's ordered migrations and current course catalog.
-- Includes no sample accounts, passwords, enrollments or bank details.
-- Refuses an existing LMS database. All schema/data/history changes are atomic.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
do $lms_fresh_project_guard$ begin
  if to_regclass('public.profiles') is not null or to_regclass('public.courses') is not null then
    raise exception 'An LMS schema already exists. Do not run fresh initialization again; use incremental migrations.';
  end if;
end $lms_fresh_project_guard$;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text);

-- Source: 202609090001_builtbyskills_lms_core.sql; SHA-256: 627952b577c4e216ff83fb08658f4f7050334d37eea3f85286e0e1b3b93cadc2
create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('super_admin', 'instructor', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.profile_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.course_status as enum ('draft', 'published', 'unpublished', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lesson_type as enum ('video', 'text', 'pdf_resource', 'live_class', 'external_resource');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lesson_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enrollment_status as enum ('pending', 'active', 'suspended', 'completed', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'under_review', 'approved', 'rejected', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method_type as enum ('bank_transfer', 'easypaisa', 'jazzcash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_provider as enum ('zoom', 'google_meet', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.live_class_status as enum ('scheduled', 'live', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  phone text,
  whatsapp text,
  avatar_url text,
  role public.user_role not null default 'student',
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  short_description text not null,
  description text not null,
  thumbnail_url text,
  category text not null,
  level text not null,
  duration_text text,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'PKR',
  status public.course_status not null default 'draft',
  featured boolean not null default false,
  instructor_id uuid references public.profiles(id) on delete set null,
  outcomes text[] not null default '{}',
  requirements text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  lesson_type public.lesson_type not null default 'video',
  mux_asset_id text,
  mux_playback_id text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  position integer not null default 0 check (position >= 0),
  is_preview boolean not null default false,
  status public.lesson_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, slug),
  unique (section_id, position)
);

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  file_path text not null,
  resource_type text not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.instructor_courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (instructor_id, course_id)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status public.enrollment_status not null default 'pending',
  enrolled_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  completion_percentage numeric(5,2) not null default 0 check (completion_percentage >= 0 and completion_percentage <= 100),
  is_completed boolean not null default false,
  last_watched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  method_type public.payment_method_type not null,
  display_name text not null,
  account_title text not null,
  account_number text not null,
  bank_name text,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete set null,
  course_id uuid not null references public.courses(id) on delete cascade,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'PKR',
  transaction_reference text,
  screenshot_path text,
  status public.payment_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  payment_submission_id uuid references public.payment_submissions(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text not null,
  whatsapp text,
  city text not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  preferred_batch text not null,
  experience_level text not null,
  message text,
  status public.enrollment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  meeting_provider public.meeting_provider not null default 'zoom',
  meeting_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.live_class_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  content text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','courses','course_sections','lessons','enrollments','lesson_progress',
    'payment_methods','payment_submissions','enrollment_requests','live_classes',
    'announcements','contact_submissions'
  ]
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid() and status = 'active' limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'super_admin', false)
$$;

create or replace function public.is_instructor_for_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instructor_courses ic
    join public.profiles p on p.id = ic.instructor_id
    where ic.course_id = target_course_id
      and p.auth_user_id = auth.uid()
      and p.role = 'instructor'
      and p.status = 'active'
  )
$$;

create or replace function public.has_active_enrollment(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.profiles p on p.id = e.student_id
    where e.course_id = target_course_id
      and p.auth_user_id = auth.uid()
      and p.role = 'student'
      and p.status = 'active'
      and e.status = 'active'
      and (e.starts_at is null or e.starts_at <= now())
      and (e.expires_at is null or e.expires_at > now())
  )
$$;

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_auth_user_idx on public.profiles(auth_user_id);
create index if not exists courses_status_featured_idx on public.courses(status, featured);
create index if not exists courses_instructor_idx on public.courses(instructor_id);
create index if not exists course_sections_course_position_idx on public.course_sections(course_id, position);
create index if not exists lessons_section_position_idx on public.lessons(section_id, position);
create index if not exists enrollments_student_status_idx on public.enrollments(student_id, status);
create index if not exists enrollments_course_status_idx on public.enrollments(course_id, status);
create index if not exists payment_submissions_status_idx on public.payment_submissions(status);
create index if not exists enrollment_requests_status_idx on public.enrollment_requests(status);
create index if not exists live_classes_course_starts_idx on public.live_classes(course_id, starts_at);
create index if not exists announcements_course_published_idx on public.announcements(course_id, is_published);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.instructor_courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.enrollment_requests enable row level security;
alter table public.live_classes enable row level security;
alter table public.announcements enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_self_read_update" on public.profiles
  for select using (auth_user_id = auth.uid() or public.is_super_admin());
create policy "profiles_self_update" on public.profiles
  for update using (auth_user_id = auth.uid() or public.is_super_admin())
  with check (auth_user_id = auth.uid() or public.is_super_admin());
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.is_super_admin());
create policy "profiles_admin_delete" on public.profiles
  for delete using (public.is_super_admin());

create policy "courses_public_or_authorized_read" on public.courses
  for select using (
    status = 'published'
    or public.is_super_admin()
    or public.is_instructor_for_course(id)
    or public.has_active_enrollment(id)
  );
create policy "courses_admin_all" on public.courses
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "sections_authorized_read" on public.course_sections
  for select using (
    public.is_super_admin()
    or public.is_instructor_for_course(course_id)
    or public.has_active_enrollment(course_id)
    or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  );
create policy "sections_admin_instructor_write" on public.course_sections
  for all using (public.is_super_admin() or public.is_instructor_for_course(course_id))
  with check (public.is_super_admin() or public.is_instructor_for_course(course_id));

create policy "lessons_authorized_read" on public.lessons
  for select using (
    is_preview = true
    or public.is_super_admin()
    or exists (
      select 1 from public.course_sections s
      where s.id = section_id
        and (public.is_instructor_for_course(s.course_id) or public.has_active_enrollment(s.course_id))
    )
  );
create policy "lessons_admin_instructor_write" on public.lessons
  for all using (
    public.is_super_admin()
    or exists (select 1 from public.course_sections s where s.id = section_id and public.is_instructor_for_course(s.course_id))
  )
  with check (
    public.is_super_admin()
    or exists (select 1 from public.course_sections s where s.id = section_id and public.is_instructor_for_course(s.course_id))
  );

create policy "resources_authorized_read" on public.lesson_resources
  for select using (
    public.is_super_admin()
    or exists (
      select 1 from public.lessons l
      join public.course_sections s on s.id = l.section_id
      where l.id = lesson_id
        and (public.is_instructor_for_course(s.course_id) or public.has_active_enrollment(s.course_id))
    )
  );
create policy "resources_admin_instructor_write" on public.lesson_resources
  for all using (
    public.is_super_admin()
    or exists (
      select 1 from public.lessons l
      join public.course_sections s on s.id = l.section_id
      where l.id = lesson_id and public.is_instructor_for_course(s.course_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.lessons l
      join public.course_sections s on s.id = l.section_id
      where l.id = lesson_id and public.is_instructor_for_course(s.course_id)
    )
  );

create policy "instructor_courses_admin_or_self_read" on public.instructor_courses
  for select using (public.is_super_admin() or instructor_id = public.current_profile_id());
create policy "instructor_courses_admin_write" on public.instructor_courses
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "enrollments_owner_instructor_admin_read" on public.enrollments
  for select using (
    public.is_super_admin()
    or student_id = public.current_profile_id()
    or public.is_instructor_for_course(course_id)
  );
create policy "enrollments_admin_write" on public.enrollments
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "lesson_progress_owner_instructor_admin_read" on public.lesson_progress
  for select using (
    public.is_super_admin()
    or student_id = public.current_profile_id()
    or exists (select 1 from public.enrollments e where e.id = enrollment_id and public.is_instructor_for_course(e.course_id))
  );
create policy "lesson_progress_owner_update" on public.lesson_progress
  for insert with check (student_id = public.current_profile_id());
create policy "lesson_progress_owner_mutate" on public.lesson_progress
  for update using (student_id = public.current_profile_id()) with check (student_id = public.current_profile_id());

create policy "payment_methods_public_read_active" on public.payment_methods
  for select using (is_active = true or public.is_super_admin());
create policy "payment_methods_admin_write" on public.payment_methods
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "payment_submissions_owner_admin_read" on public.payment_submissions
  for select using (public.is_super_admin() or student_id = public.current_profile_id());
create policy "payment_submissions_public_insert" on public.payment_submissions
  for insert with check (true);
create policy "payment_submissions_admin_update" on public.payment_submissions
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy "enrollment_requests_admin_read" on public.enrollment_requests
  for select using (public.is_super_admin());
create policy "enrollment_requests_public_insert" on public.enrollment_requests
  for insert with check (true);
create policy "enrollment_requests_admin_update" on public.enrollment_requests
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy "live_classes_authorized_read" on public.live_classes
  for select using (
    public.is_super_admin()
    or public.is_instructor_for_course(course_id)
    or public.has_active_enrollment(course_id)
  );
create policy "live_classes_admin_instructor_write" on public.live_classes
  for all using (public.is_super_admin() or public.is_instructor_for_course(course_id))
  with check (public.is_super_admin() or public.is_instructor_for_course(course_id));

create policy "announcements_authorized_read" on public.announcements
  for select using (
    public.is_super_admin()
    or (is_published = true and course_id is null)
    or public.is_instructor_for_course(course_id)
    or public.has_active_enrollment(course_id)
  );
create policy "announcements_admin_instructor_write" on public.announcements
  for all using (public.is_super_admin() or public.is_instructor_for_course(course_id))
  with check (public.is_super_admin() or public.is_instructor_for_course(course_id));

create policy "contact_submissions_public_insert" on public.contact_submissions
  for insert with check (true);
create policy "contact_submissions_admin_read_update" on public.contact_submissions
  for select using (public.is_super_admin());
create policy "contact_submissions_admin_update" on public.contact_submissions
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy "notifications_owner_read_update" on public.notifications
  for select using (profile_id = public.current_profile_id() or public.is_super_admin());
create policy "notifications_owner_update" on public.notifications
  for update using (profile_id = public.current_profile_id() or public.is_super_admin())
  with check (profile_id = public.current_profile_id() or public.is_super_admin());
create policy "notifications_admin_insert" on public.notifications
  for insert with check (public.is_super_admin());

create policy "audit_logs_admin_read" on public.audit_logs
  for select using (public.is_super_admin());
create policy "audit_logs_admin_insert" on public.audit_logs
  for insert with check (public.is_super_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-thumbnails', 'course-thumbnails', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('payment-screenshots', 'payment-screenshots', false, 5242880, array['image/png','image/jpeg','image/webp','application/pdf']),
  ('lesson-resources', 'lesson-resources', false, 26214400, array['application/pdf','image/png','image/jpeg','image/webp','application/zip','text/plain'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "course_thumbnails_public_read" on storage.objects
  for select using (bucket_id = 'course-thumbnails');
create policy "course_thumbnails_admin_write" on storage.objects
  for all using (bucket_id = 'course-thumbnails' and public.is_super_admin())
  with check (bucket_id = 'course-thumbnails' and public.is_super_admin());
create policy "payment_screenshots_admin_or_owner_read" on storage.objects
  for select using (
    bucket_id = 'payment-screenshots'
    and (
      public.is_super_admin()
      or owner = auth.uid()
    )
  );
create policy "payment_screenshots_authenticated_upload" on storage.objects
  for insert with check (bucket_id = 'payment-screenshots' and auth.uid() is not null);
create policy "lesson_resources_authorized_read" on storage.objects
  for select using (
    bucket_id = 'lesson-resources'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.lesson_resources lr
        join public.lessons l on l.id = lr.lesson_id
        join public.course_sections s on s.id = l.section_id
        where lr.file_path = storage.objects.name
          and (public.is_instructor_for_course(s.course_id) or public.has_active_enrollment(s.course_id))
      )
    )
  );
create policy "lesson_resources_admin_instructor_write" on storage.objects
  for all using (bucket_id = 'lesson-resources' and public.is_super_admin())
  with check (bucket_id = 'lesson-resources' and public.is_super_admin());

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609090001','builtbyskills_lms_core',array[]::text[]);

-- Source: 202609100001_skills.sql; SHA-256: 919770f6caf5d43122338f4fc886ba54d27288f41f5df1cffb2477f20beef179
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image text,
  image_alt text,
  icon_name text not null default 'target',
  position integer not null default 0 check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skills_slug_idx on public.skills(slug);
create index if not exists skills_position_idx on public.skills(position);
create index if not exists skills_active_idx on public.skills(is_active);

alter table public.skills enable row level security;

create policy "skills_public_read_active" on public.skills
  for select using (is_active = true or public.is_super_admin());

create policy "skills_admin_all" on public.skills
  for all using (public.is_super_admin()) with check (public.is_super_admin());

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609100001','skills',array[]::text[]);

-- Source: 202609130001_drop_skills.sql; SHA-256: 6a95accededa159fb4edd3e32a0959c03e12adebf6703a2793ff634571f99353
drop policy if exists "skills_public_read_active" on public.skills;
drop policy if exists "skills_admin_all" on public.skills;

drop index if exists public.skills_active_idx;
drop index if exists public.skills_position_idx;
drop index if exists public.skills_slug_idx;

drop table if exists public.skills;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609130001','drop_skills',array[]::text[]);

-- Source: 202609140001_secure_profile_self_updates.sql; SHA-256: b7266eea5989343ce5be3f061bba14592bc06348cd9fdebea9b24f0c4aaf8422
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

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609140001','secure_profile_self_updates',array[]::text[]);

-- Source: 202609140002_safe_payment_approval.sql; SHA-256: 4a2cea0f3e82ece01643f1ae3718978445e9384b15545f18321f4b49629b48dc
-- Auth creation stays in the server action. This RPC resolves identity twice:
-- before Auth creation and again under locks when committing PostgreSQL writes.
-- No new relationships or status values are needed.
create function public.approve_student_payment(
  p_payment_id uuid,
  p_admin_id uuid,
  p_finalize boolean default false,
  p_auth_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  payment public.payment_submissions%rowtype;
  request public.enrollment_requests%rowtype;
  student public.profiles%rowtype;
  auth_user auth.users%rowtype;
  enrollment public.enrollments%rowtype;
  matched_ids uuid[];
  email_address text;
  student_name text;
  course_title text;
  activate boolean := false;
  receipt_id uuid;
  receipt_metadata jsonb;
begin
  -- The only API caller is the service role; the action also verifies its admin.
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  perform 1 from public.profiles
    where id = p_admin_id and role = 'super_admin' and status = 'active' for share;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;

  select * into payment from public.payment_submissions where id = p_payment_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'missing_payment'); end if;
  if payment.status not in ('pending', 'under_review', 'approved') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_state');
  end if;

  select array_agg(id) into matched_ids from public.enrollment_requests where payment_submission_id = payment.id;
  if coalesce(cardinality(matched_ids), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;
  if cardinality(matched_ids) = 1 then
    select * into request from public.enrollment_requests where id = matched_ids[1] for update;
    if request.course_id <> payment.course_id or request.status not in ('pending', 'active') then
      return jsonb_build_object('ok', false, 'reason', 'invalid_request');
    end if;
    email_address := lower(btrim(request.email));
    student_name := request.full_name;
  elsif payment.student_id is not null then
    select lower(btrim(email)), full_name into email_address, student_name
      from public.profiles where id = payment.student_id;
  end if;
  if email_address is null or email_address = '' or student_name is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;
  select title into course_title from public.courses where id = payment.course_id for share;
  if not found then return jsonb_build_object('ok', false, 'reason', 'missing_course'); end if;

  -- Serialize approvals for a logical email, including when no profile exists yet.
  perform pg_advisory_xact_lock(hashtextextended('payment-student:' || email_address, 0));
  select array_agg(id) into matched_ids from auth.users where lower(btrim(email)) = email_address;
  if coalesce(cardinality(matched_ids), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;
  if cardinality(matched_ids) = 1 then
    select * into auth_user from auth.users where id = matched_ids[1] for share;
    if lower(btrim(auth_user.email)) is distinct from email_address
       or auth_user.deleted_at is not null or auth_user.banned_until > now()
       or auth_user.email_confirmed_at is null
       or coalesce(auth_user.raw_user_meta_data->>'role', '') in ('super_admin', 'instructor')
       or coalesce(auth_user.raw_app_meta_data->>'role', '') in ('super_admin', 'instructor') then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;
  end if;

  select array_agg(id) into matched_ids from public.profiles
    where lower(btrim(email)) = email_address or auth_user_id = auth_user.id;
  if coalesce(cardinality(matched_ids), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;
  if cardinality(matched_ids) = 1 then
    select * into student from public.profiles where id = matched_ids[1] for update;
    if student.role <> 'student' or student.status <> 'active'
       or lower(btrim(student.email)) <> email_address
       or (student.auth_user_id is not null and student.auth_user_id is distinct from auth_user.id) then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;
  elsif auth_user.id is not null
        and coalesce(auth_user.raw_user_meta_data->>'role', '') <> 'student' then
    -- An orphan Auth identity must be recognizably compatible. Metadata never
    -- grants privileged access: any matching privileged profile above is denied.
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;
  if payment.student_id is not null and payment.student_id is distinct from student.id then
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;

  if student.id is not null then
    select * into enrollment from public.enrollments
      where student_id = student.id and course_id = payment.course_id for update;
  end if;
  if payment.status = 'approved' then
    -- Replay is read-only: an existing row alone does not prove usable access.
    -- Match the access contract: nullable bounds, inclusive start, exclusive expiry.
    if student.auth_user_id is null or payment.student_id is distinct from student.id or enrollment.id is null
       or enrollment.status is distinct from 'active'
       or (enrollment.starts_at is not null and enrollment.starts_at > now())
       or (enrollment.expires_at is not null and enrollment.expires_at <= now())
       or (request.id is not null and request.status is distinct from 'active') then
      return jsonb_build_object('ok', false, 'reason', 'incomplete_approval');
    end if;
    if p_finalize and p_auth_user_id is distinct from auth_user.id then
      return jsonb_build_object('ok', false, 'reason', 'identity_changed');
    end if;
    select metadata into receipt_metadata from public.audit_logs
      where action = 'payment.reviewed' and entity_id = payment.id and metadata->>'approval_version' = '1'
      order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'already_approved', true,
      'email_status', coalesce(receipt_metadata->>'email_status', 'unknown'));
  end if;

  if enrollment.id is not null and (enrollment.status not in ('pending', 'active')
      or enrollment.expires_at <= now()
      or (enrollment.expires_at is not null and enrollment.expires_at <= coalesce(enrollment.starts_at, now()))) then
    return jsonb_build_object('ok', false, 'reason', 'enrollment_conflict');
  end if;
  if not p_finalize then
    return jsonb_build_object('ok', true, 'auth_user_id', auth_user.id,
      'email', email_address, 'full_name', student_name);
  end if;
  if auth_user.id is null or auth_user.id is distinct from p_auth_user_id then
    return jsonb_build_object('ok', false, 'reason', 'identity_changed');
  end if;

  -- This exception block rolls back ALL profile/enrollment/payment/audit writes.
  begin
    activate := student.id is null or student.auth_user_id is null
      or coalesce(auth_user.raw_app_meta_data->>'payment_provisioned', '') = 'true';
    if student.id is null then
      insert into public.profiles (auth_user_id, full_name, email, phone, whatsapp, role, status)
        values (auth_user.id, student_name, email_address, request.phone, request.whatsapp, 'student', 'active')
        returning * into student;
    elsif student.auth_user_id is null then
      -- No upsert by email, and no role/status/personal-information overwrite.
      update public.profiles set auth_user_id = auth_user.id where id = student.id returning * into student;
    end if;
    if enrollment.id is null then
      insert into public.enrollments (student_id, course_id, status, enrolled_at, starts_at, assigned_by)
        values (student.id, payment.course_id, 'active', now(), now(), p_admin_id)
        on conflict (student_id, course_id) do nothing;
      select * into enrollment from public.enrollments
        where student_id = student.id and course_id = payment.course_id for update;
    end if;
    -- A concurrent manual assignment may have won the unique constraint.
    if enrollment.status not in ('pending', 'active') or enrollment.expires_at <= now()
       or (enrollment.expires_at is not null and enrollment.expires_at <= coalesce(enrollment.starts_at, now())) then
      raise exception 'enrollment_conflict' using errcode = 'P0001';
    end if;
    if enrollment.status = 'pending' then
      update public.enrollments set status = 'active', enrolled_at = coalesce(enrolled_at, now()),
        starts_at = coalesce(starts_at, now()), assigned_by = coalesce(assigned_by, p_admin_id)
        where id = enrollment.id;
    end if;
    update public.payment_submissions set student_id = student.id, status = 'approved',
      rejection_reason = null, reviewed_by = p_admin_id, reviewed_at = now() where id = payment.id;
    if request.id is not null then
      update public.enrollment_requests set status = 'active' where id = request.id;
    end if;
    activate := activate
      and coalesce(auth_user.encrypted_password, '') = ''
      and not exists (select 1 from public.audit_logs where action = 'payment.reviewed'
        and metadata->>'auth_user_id' = auth_user.id::text and metadata->>'activation' = 'true');
    receipt_metadata := jsonb_build_object('status', 'approved', 'approval_version', 1,
      'student_id', student.id, 'auth_user_id', auth_user.id, 'enrollment_id', enrollment.id,
      'activation', activate, 'email_status', 'pending');
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      values (p_admin_id, 'payment.reviewed', 'payment_submission', payment.id, receipt_metadata)
      returning id into receipt_id;
  exception
    when unique_violation then return jsonb_build_object('ok', false, 'reason', 'identity_changed');
    when raise_exception then return jsonb_build_object('ok', false, 'reason', 'enrollment_conflict');
    when others then return jsonb_build_object('ok', false, 'reason', 'finalization_failed');
  end;
  return jsonb_build_object('ok', true, 'already_approved', false, 'activation', activate,
    'email', email_address, 'full_name', student.full_name, 'course_title', course_title,
    'receipt_id', receipt_id, 'receipt_metadata', receipt_metadata);
end;
$$;

revoke all on function public.approve_student_payment(uuid, uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.approve_student_payment(uuid, uuid, boolean, uuid) to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202609140002','safe_payment_approval',array[]::text[]);

-- Source: 202610010001_add_payment_method_iban.sql; SHA-256: 5d53829fc0d4754926955f9d53ced9d472e8e7acce6654f1fe91fe352d5f6797
-- Keep existing account numbers and payment methods intact.
-- IBAN is optional so bank transfers and mobile wallets remain compatible.
alter table public.payment_methods
  add column if not exists iban_number text;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202610010001','add_payment_method_iban',array[]::text[]);

-- Source: 202610010002_course_builder_security.sql; SHA-256: ddbec58405ecec8bc5e52b39d29d9b85c5a749e496ce8a5decfbb254501d4f34
-- Forward-only: persist the server-created upload binding and restrict student
-- access to published content. Existing Mux metadata and curriculum order stay intact.
alter table public.lessons add column if not exists mux_upload_id text;

create or replace function public.can_access_published_lesson(target_lesson_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.lessons l join public.course_sections s on s.id = l.section_id
    where l.id = target_lesson_id and l.status = 'published'
      and public.has_active_enrollment(s.course_id)
  )
$$;

drop policy if exists "lessons_authorized_read" on public.lessons;
create policy "lessons_authorized_read" on public.lessons for select using (
  public.is_super_admin()
  or exists (select 1 from public.course_sections s where s.id = section_id and public.is_instructor_for_course(s.course_id))
  or public.can_access_published_lesson(id)
);
-- is_preview remains legacy metadata, not public access permission.

drop policy if exists "resources_authorized_read" on public.lesson_resources;
create policy "resources_authorized_read" on public.lesson_resources for select using (
  public.is_super_admin() or public.can_access_published_lesson(lesson_id)
  or exists (select 1 from public.lessons l join public.course_sections s on s.id = l.section_id
    where l.id = lesson_id and public.is_instructor_for_course(s.course_id))
);

drop policy if exists "lesson_resources_authorized_read" on storage.objects;
create policy "lesson_resources_authorized_read" on storage.objects for select using (
  bucket_id = 'lesson-resources' and (
    public.is_super_admin() or exists (
      select 1 from public.lesson_resources lr join public.lessons l on l.id = lr.lesson_id
      join public.course_sections s on s.id = l.section_id
      where lr.file_path = storage.objects.name and lr.resource_type <> 'external_link'
        and (public.is_instructor_for_course(s.course_id) or public.can_access_published_lesson(l.id))
    )
  )
);

create or replace function public.can_write_lesson_progress(target_lesson_id uuid, target_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_access_published_lesson(target_lesson_id) and exists (
    select 1 from public.enrollments e join public.course_sections s on s.course_id = e.course_id
    join public.lessons l on l.section_id = s.id
    where l.id = target_lesson_id and e.id = target_enrollment_id
      and e.student_id = public.current_profile_id()
  )
$$;
drop policy if exists "lesson_progress_owner_update" on public.lesson_progress;
drop policy if exists "lesson_progress_owner_mutate" on public.lesson_progress;
create policy "lesson_progress_owner_update" on public.lesson_progress for insert with check (
  student_id = public.current_profile_id() and public.can_write_lesson_progress(lesson_id, enrollment_id)
);
create policy "lesson_progress_owner_mutate" on public.lesson_progress for update using (
  student_id = public.current_profile_id() and public.can_write_lesson_progress(lesson_id, enrollment_id)
) with check (
  student_id = public.current_profile_id() and public.can_write_lesson_progress(lesson_id, enrollment_id)
);

insert into supabase_migrations.schema_migrations(version,name,statements) values('202610010002','course_builder_security',array[]::text[]);

-- Source: 202610020001_youtube_lesson_video.sql; SHA-256: 36a36b9e1cdb5840f17fdd49f42213ed8c983662939cf8ece8b3cc8e419124b7
-- Forward-only, additive. Review/apply manually; historical video data is retained.
alter table public.lessons add column if not exists youtube_video_id text;
alter table public.lessons add constraint lessons_youtube_video_id_format
  check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$');
comment on column public.lessons.youtube_video_id is
  'Canonical YouTube video ID. URL syntax does not verify Unlisted visibility or availability.';
-- No backfill, publication changes, RLS changes, or removal of legacy Mux fields.

insert into supabase_migrations.schema_migrations(version,name,statements) values('202610020001','youtube_lesson_video',array[]::text[]);

-- Source: 202610020002_payment_password_setup.sql; SHA-256: 8aeb36d0a4a358da5c63e15d311f01364a391c8c591856c93e582e91618e097c
-- Distinguish Auth-generated passwords from completed student setup.
-- Existing passwords and historical receipts are never rewritten.
-- Auth creation stays in the server action. This RPC resolves identity twice:
-- before Auth creation and again under locks when committing PostgreSQL writes.
-- No new relationships or status values are needed.
create or replace function public.approve_student_payment(
  p_payment_id uuid,
  p_admin_id uuid,
  p_finalize boolean default false,
  p_auth_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  payment public.payment_submissions%rowtype;
  request public.enrollment_requests%rowtype;
  student public.profiles%rowtype;
  auth_user auth.users%rowtype;
  enrollment public.enrollments%rowtype;
  matched_ids uuid[];
  email_address text;
  student_name text;
  course_title text;
  activate boolean := false;
  receipt_id uuid;
  receipt_metadata jsonb;
begin
  -- The only API caller is the service role; the action also verifies its admin.
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  perform 1 from public.profiles
    where id = p_admin_id and role = 'super_admin' and status = 'active' for share;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;

  select * into payment from public.payment_submissions where id = p_payment_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'missing_payment'); end if;
  if payment.status not in ('pending', 'under_review', 'approved') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_state');
  end if;

  select array_agg(id) into matched_ids from public.enrollment_requests where payment_submission_id = payment.id;
  if coalesce(cardinality(matched_ids), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;
  if cardinality(matched_ids) = 1 then
    select * into request from public.enrollment_requests where id = matched_ids[1] for update;
    if request.course_id <> payment.course_id or request.status not in ('pending', 'active') then
      return jsonb_build_object('ok', false, 'reason', 'invalid_request');
    end if;
    email_address := lower(btrim(request.email));
    student_name := request.full_name;
  elsif payment.student_id is not null then
    select lower(btrim(email)), full_name into email_address, student_name
      from public.profiles where id = payment.student_id;
  end if;
  if email_address is null or email_address = '' or student_name is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;
  select title into course_title from public.courses where id = payment.course_id for share;
  if not found then return jsonb_build_object('ok', false, 'reason', 'missing_course'); end if;

  -- Serialize approvals for a logical email, including when no profile exists yet.
  perform pg_advisory_xact_lock(hashtextextended('payment-student:' || email_address, 0));
  select array_agg(id) into matched_ids from auth.users where lower(btrim(email)) = email_address;
  if coalesce(cardinality(matched_ids), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;
  if cardinality(matched_ids) = 1 then
    select * into auth_user from auth.users where id = matched_ids[1] for share;
    if lower(btrim(auth_user.email)) is distinct from email_address
       or auth_user.deleted_at is not null or auth_user.banned_until > now()
       or auth_user.email_confirmed_at is null
       or coalesce(auth_user.raw_user_meta_data->>'role', '') in ('super_admin', 'instructor')
       or coalesce(auth_user.raw_app_meta_data->>'role', '') in ('super_admin', 'instructor') then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;
  end if;

  select array_agg(id) into matched_ids from public.profiles
    where lower(btrim(email)) = email_address or auth_user_id = auth_user.id;
  if coalesce(cardinality(matched_ids), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;
  if cardinality(matched_ids) = 1 then
    select * into student from public.profiles where id = matched_ids[1] for update;
    if student.role <> 'student' or student.status <> 'active'
       or lower(btrim(student.email)) <> email_address
       or (student.auth_user_id is not null and student.auth_user_id is distinct from auth_user.id) then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;
  elsif auth_user.id is not null
        and coalesce(auth_user.raw_user_meta_data->>'role', '') <> 'student' then
    -- An orphan Auth identity must be recognizably compatible. Metadata never
    -- grants privileged access: any matching privileged profile above is denied.
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;
  if payment.student_id is not null and payment.student_id is distinct from student.id then
    return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
  end if;

  if student.id is not null then
    select * into enrollment from public.enrollments
      where student_id = student.id and course_id = payment.course_id for update;
  end if;
  if payment.status = 'approved' then
    -- Replay is read-only: an existing row alone does not prove usable access.
    -- Match the access contract: nullable bounds, inclusive start, exclusive expiry.
    if student.auth_user_id is null or payment.student_id is distinct from student.id or enrollment.id is null
       or enrollment.status is distinct from 'active'
       or (enrollment.starts_at is not null and enrollment.starts_at > now())
       or (enrollment.expires_at is not null and enrollment.expires_at <= now())
       or (request.id is not null and request.status is distinct from 'active') then
      return jsonb_build_object('ok', false, 'reason', 'incomplete_approval');
    end if;
    if p_finalize and p_auth_user_id is distinct from auth_user.id then
      return jsonb_build_object('ok', false, 'reason', 'identity_changed');
    end if;
    select metadata into receipt_metadata from public.audit_logs
      where action = 'payment.reviewed' and entity_id = payment.id and metadata->>'approval_version' = '1'
      order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'already_approved', true,
      'email_status', coalesce(receipt_metadata->>'email_status', 'unknown'));
  end if;

  if enrollment.id is not null and (enrollment.status not in ('pending', 'active')
      or enrollment.expires_at <= now()
      or (enrollment.expires_at is not null and enrollment.expires_at <= coalesce(enrollment.starts_at, now()))) then
    return jsonb_build_object('ok', false, 'reason', 'enrollment_conflict');
  end if;
  if not p_finalize then
    return jsonb_build_object('ok', true, 'auth_user_id', auth_user.id,
      'email', email_address, 'full_name', student_name);
  end if;
  if auth_user.id is null or auth_user.id is distinct from p_auth_user_id then
    return jsonb_build_object('ok', false, 'reason', 'identity_changed');
  end if;

  -- This exception block rolls back ALL profile/enrollment/payment/audit writes.
  begin
    activate := student.id is null or student.auth_user_id is null
      or coalesce(auth_user.raw_app_meta_data->>'payment_provisioned', '') = 'true';
    if student.id is null then
      insert into public.profiles (auth_user_id, full_name, email, phone, whatsapp, role, status)
        values (auth_user.id, student_name, email_address, request.phone, request.whatsapp, 'student', 'active')
        returning * into student;
    elsif student.auth_user_id is null then
      -- No upsert by email, and no role/status/personal-information overwrite.
      update public.profiles set auth_user_id = auth_user.id where id = student.id returning * into student;
    end if;
    if enrollment.id is null then
      insert into public.enrollments (student_id, course_id, status, enrolled_at, starts_at, assigned_by)
        values (student.id, payment.course_id, 'active', now(), now(), p_admin_id)
        on conflict (student_id, course_id) do nothing;
      select * into enrollment from public.enrollments
        where student_id = student.id and course_id = payment.course_id for update;
    end if;
    -- A concurrent manual assignment may have won the unique constraint.
    if enrollment.status not in ('pending', 'active') or enrollment.expires_at <= now()
       or (enrollment.expires_at is not null and enrollment.expires_at <= coalesce(enrollment.starts_at, now())) then
      raise exception 'enrollment_conflict' using errcode = 'P0001';
    end if;
    if enrollment.status = 'pending' then
      update public.enrollments set status = 'active', enrolled_at = coalesce(enrolled_at, now()),
        starts_at = coalesce(starts_at, now()), assigned_by = coalesce(assigned_by, p_admin_id)
        where id = enrollment.id;
    end if;
    update public.payment_submissions set student_id = student.id, status = 'approved',
      rejection_reason = null, reviewed_by = p_admin_id, reviewed_at = now() where id = payment.id;
    if request.id is not null then
      update public.enrollment_requests set status = 'active' where id = request.id;
    end if;
    activate := activate
      and (
        coalesce(auth_user.encrypted_password, '') = ''
        or (
          -- Admin createUser generates a random hash even without a password.
          -- Only explicitly marked, never-used accounts need first setup.
          coalesce(auth_user.raw_app_meta_data->>'payment_password_setup_required', '') = 'true'
          and auth_user.last_sign_in_at is null
        )
      )
      and not exists (select 1 from public.audit_logs where action = 'payment.reviewed'
        and metadata->>'auth_user_id' = auth_user.id::text and metadata->>'activation' = 'true');
    receipt_metadata := jsonb_build_object('status', 'approved', 'approval_version', 1,
      'student_id', student.id, 'auth_user_id', auth_user.id, 'enrollment_id', enrollment.id,
      'activation', activate, 'email_status', 'pending');
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      values (p_admin_id, 'payment.reviewed', 'payment_submission', payment.id, receipt_metadata)
      returning id into receipt_id;
  exception
    when unique_violation then return jsonb_build_object('ok', false, 'reason', 'identity_changed');
    when raise_exception then return jsonb_build_object('ok', false, 'reason', 'enrollment_conflict');
    when others then return jsonb_build_object('ok', false, 'reason', 'finalization_failed');
  end;
  return jsonb_build_object('ok', true, 'already_approved', false, 'activation', activate,
    'email', email_address, 'full_name', student.full_name, 'course_title', course_title,
    'receipt_id', receipt_id, 'receipt_metadata', receipt_metadata);
end;
$$;

revoke all on function public.approve_student_payment(uuid, uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.approve_student_payment(uuid, uuid, boolean, uuid) to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202610020002','payment_password_setup',array[]::text[]);

-- Source: 202610020003_safe_admin_deletion.sql; SHA-256: e84adddf7566f968ad93d618ccd2d97ca8aea025059b5e2ec72d0d9aea64ac7d


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



insert into supabase_migrations.schema_migrations(version,name,statements) values('202610020003','safe_admin_deletion',array[]::text[]);

-- Source: 202610030001_private_r2_lesson_videos.sql; SHA-256: 21572602e3221f52641d4350d33b954bdda7608395925ff1b811d0e2686649ea
-- Additive only. Manually apply after the existing LMS/YouTube security migrations.

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


insert into supabase_migrations.schema_migrations(version,name,statements) values('202610030001','private_r2_lesson_videos',array[]::text[]);

-- Source: 202610030002_admin_verified_r2_video_ready.sql; SHA-256: c92ad178774af4019365d99f897e056bdd7c6b5245fcac6d0f5aabc16fdb5393
-- Trusted-admin object verification replaces mandatory deep media inspection.
-- Forward only; prerequisite: 202610030001. No existing data is promoted.

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


insert into supabase_migrations.schema_migrations(version,name,statements) values('202610030002','admin_verified_r2_video_ready',array[]::text[]);

-- Source: 202610240001_course_portals.sql; SHA-256: 7b251190123c446032faa59388344a62efdeffafa7ff93c80780f2ee344db199
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

insert into supabase_migrations.schema_migrations(version,name,statements) values('202610240001','course_portals',array[]::text[]);

-- Explicit Data API grants for the new project. Every listed table has RLS enabled.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles, public.courses, public.course_sections, public.lessons, public.payment_methods to anon;
grant select, insert, update, delete on public.profiles, public.courses, public.course_sections, public.lessons, public.lesson_resources, public.instructor_courses, public.enrollments, public.lesson_progress, public.payment_methods, public.payment_submissions, public.enrollment_requests, public.live_classes, public.announcements, public.contact_submissions, public.notifications, public.audit_logs, public.course_recordings to authenticated;
grant all on public.profiles, public.courses, public.course_sections, public.lessons, public.lesson_resources, public.instructor_courses, public.enrollments, public.lesson_progress, public.payment_methods, public.payment_submissions, public.enrollment_requests, public.live_classes, public.announcements, public.contact_submissions, public.notifications, public.audit_logs, public.course_recordings to service_role;

-- Starter catalog matching the five course cards (PKR 10,000 each). No legacy records are imported.
insert into public.courses(title,slug,short_description,description,thumbnail_url,category,level,duration_text,price,currency,status,featured,outcomes,requirements) values('Amazon Success Course','amazon','Build practical marketplace skills, from product research and sourcing to listings, fulfillment, and day-to-day seller operations.','Build practical marketplace skills, from product research and sourcing to listings, fulfillment, and day-to-day seller operations.','/img/courses/amazon.webp','E-Commerce','Beginner','Flexible',10000,'PKR','published',true,array['Marketplace foundations','Product research & sourcing','Listings & fulfillment','Seller operations & client work'],array['A laptop or desktop computer','A reliable internet connection','Time to practise between sessions']);
insert into public.course_sections(course_id,title,description,position) select id,'Marketplace foundations','Amazon business models and seller workflows
Seller Central navigation and account health
Understanding marketplace fees and product margins',0 from public.courses where slug='amazon';
insert into public.course_sections(course_id,title,description,position) select id,'Product research & sourcing','Demand, competition, and product selection
Supplier research and sourcing fundamentals
Costing, profitability, and inventory planning',1 from public.courses where slug='amazon';
insert into public.course_sections(course_id,title,description,position) select id,'Listings & fulfillment','Keyword research, product titles, and listing content
Product imagery and listing optimization
FBA and FBM workflows, shipments, and order management',2 from public.courses where slug='amazon';
insert into public.course_sections(course_id,title,description,position) select id,'Seller operations & client work','Performance reporting and account handling
Customer service and operational checklists
Packaging Amazon virtual assistant services',3 from public.courses where slug='amazon';
insert into public.courses(title,slug,short_description,description,thumbnail_url,category,level,duration_text,price,currency,status,featured,outcomes,requirements) values('Digital Marketing','digital-marketing','Plan, launch, and improve digital campaigns with a practical approach to audience research, creative strategy, paid media, and reporting.','Plan, launch, and improve digital campaigns with a practical approach to audience research, creative strategy, paid media, and reporting.','/img/courses/digital-marketing.webp','Digital Marketing','Beginner','Flexible',10000,'PKR','published',true,array['Strategy & audience research','Content & brand presence','Paid campaigns & tracking','Optimization & client reporting'],array['A laptop or desktop computer','A reliable internet connection','Time to practise between sessions']);
insert into public.course_sections(course_id,title,description,position) select id,'Strategy & audience research','Marketing objectives and the customer journey
Audience research and competitor analysis
Content planning and campaign briefs',0 from public.courses where slug='digital-marketing';
insert into public.course_sections(course_id,title,description,position) select id,'Content & brand presence','Social media strategy and content calendars
Creative formats, messaging, and calls to action
Search visibility and SEO fundamentals',1 from public.courses where slug='digital-marketing';
insert into public.course_sections(course_id,title,description,position) select id,'Paid campaigns & tracking','Meta Ads Manager and campaign structure
Audience targeting, creatives, and budget planning
Pixel, event tracking, and retargeting fundamentals',2 from public.courses where slug='digital-marketing';
insert into public.course_sections(course_id,title,description,position) select id,'Optimization & client reporting','Reading campaign metrics and performance reports
Testing creatives and improving budget allocation
Presenting results and managing client campaigns',3 from public.courses where slug='digital-marketing';
insert into public.courses(title,slug,short_description,description,thumbnail_url,category,level,duration_text,price,currency,status,featured,outcomes,requirements) values('eBay Complete Course','ebay','Learn the workflows behind a well-managed eBay business, including sourcing, product listings, shipping, customer service, and seller performance.','Learn the workflows behind a well-managed eBay business, including sourcing, product listings, shipping, customer service, and seller performance.','/img/courses/ebay.webp','E-Commerce','Beginner','Flexible',10000,'PKR','published',true,array['Seller foundations','Product research & sourcing','Listings & order management','Customer experience & growth'],array['A laptop or desktop computer','A reliable internet connection','Time to practise between sessions']);
insert into public.course_sections(course_id,title,description,position) select id,'Seller foundations','Marketplace navigation and store setup
Seller standards and account management
Fees, pricing, and profit calculations',0 from public.courses where slug='ebay';
insert into public.course_sections(course_id,title,description,position) select id,'Product research & sourcing','Researching demand and competing listings
Evaluating suppliers and product opportunities
Inventory and pricing decisions',1 from public.courses where slug='ebay';
insert into public.course_sections(course_id,title,description,position) select id,'Listings & order management','Titles, item specifics, photography, and descriptions
Listing optimization and store organization
Order processing, shipping, and tracking',2 from public.courses where slug='ebay';
insert into public.course_sections(course_id,title,description,position) select id,'Customer experience & growth','Buyer communication and returns workflows
Seller performance and sales reporting
Preparing an eBay virtual assistant service offer',3 from public.courses where slug='ebay';
insert into public.courses(title,slug,short_description,description,thumbnail_url,category,level,duration_text,price,currency,status,featured,outcomes,requirements) values('Graphic Designing','graphic-design','Develop a strong design foundation and learn to turn a brief into clear visual communication for brands, social media, and your portfolio.','Develop a strong design foundation and learn to turn a brief into clear visual communication for brands, social media, and your portfolio.','/img/courses/graphic-design.webp','Design','Beginner','Flexible',10000,'PKR','published',true,array['Design foundations','Tools & production workflow','Brand & marketing design','Portfolio & client delivery'],array['A laptop or desktop computer','A reliable internet connection','Time to practise between sessions']);
insert into public.course_sections(course_id,title,description,position) select id,'Design foundations','Composition, visual hierarchy, and spacing
Color theory and typography
Understanding briefs and visual references',0 from public.courses where slug='graphic-design';
insert into public.course_sections(course_id,title,description,position) select id,'Tools & production workflow','Photoshop layers, selections, and masks
Photo editing, retouching, and image preparation
Illustrator fundamentals and vector artwork',1 from public.courses where slug='graphic-design';
insert into public.course_sections(course_id,title,description,position) select id,'Brand & marketing design','Logo concepts and brand identity basics
Social media creatives and campaign assets
Print layouts and export preparation',2 from public.courses where slug='graphic-design';
insert into public.course_sections(course_id,title,description,position) select id,'Portfolio & client delivery','Presenting concepts and responding to feedback
Organizing source files and final deliverables
Building case studies and a freelance design offer',3 from public.courses where slug='graphic-design';
insert into public.courses(title,slug,short_description,description,thumbnail_url,category,level,duration_text,price,currency,status,featured,outcomes,requirements) values('Shopify Complete Course','shopify','Learn how to build and manage an online store, with practical guidance on product research, storefront design, operations, and launch planning.','Learn how to build and manage an online store, with practical guidance on product research, storefront design, operations, and launch planning.','/img/courses/shopify.webp','E-Commerce','Beginner','Flexible',10000,'PKR','published',true,array['Ecommerce & product strategy','Store setup & design','Operations & launch','Marketing & store improvement'],array['A laptop or desktop computer','A reliable internet connection','Time to practise between sessions']);
insert into public.course_sections(course_id,title,description,position) select id,'Ecommerce & product strategy','Store models and customer research
Product selection and competitor analysis
Pricing, margins, and sourcing fundamentals',0 from public.courses where slug='shopify';
insert into public.course_sections(course_id,title,description,position) select id,'Store setup & design','Shopify navigation and store configuration
Themes, branding, and mobile-friendly layouts
Product pages, collections, and navigation',1 from public.courses where slug='shopify';
insert into public.course_sections(course_id,title,description,position) select id,'Operations & launch','Payment and shipping configuration
Store policies and order management
Testing the customer journey before launch',2 from public.courses where slug='shopify';
insert into public.course_sections(course_id,title,description,position) select id,'Marketing & store improvement','Traffic sources and advertising fundamentals
Conversion basics and store analytics
Presenting a store project to potential clients',3 from public.courses where slug='shopify';
notify pgrst, 'reload schema';
commit;
