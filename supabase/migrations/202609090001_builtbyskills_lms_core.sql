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
