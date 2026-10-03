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
