\set ON_ERROR_STOP on
create function public.test_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
create function public.expect_denied(statement text) returns void language plpgsql as $$
begin execute statement; raise exception 'Expected permission denial'; exception when insufficient_privilege or check_violation then null; end $$;
insert into auth.users(id,email,email_confirmed_at) values
('10000000-0000-4000-8000-000000000001','admin@test.invalid',now()),
('10000000-0000-4000-8000-000000000002','teacher@test.invalid',now()),
('10000000-0000-4000-8000-000000000003','student@test.invalid',now()),
('10000000-0000-4000-8000-000000000004','multi@test.invalid',now()),
('10000000-0000-4000-8000-000000000005','signup@test.invalid',now()),
('10000000-0000-4000-8000-000000000006','unconfirmed@test.invalid',null);
insert into public.profiles(id,auth_user_id,email,full_name,role) select id,id,email,email,
case when email like 'admin%' then 'super_admin'::public.user_role when email like 'teacher%' then 'instructor'::public.user_role else 'student'::public.user_role end
from auth.users where email not in ('signup@test.invalid','unconfirmed@test.invalid');
insert into public.courses(id,title,slug,short_description,description,category,level,status,instructor_id)
select ('20000000-0000-4000-8000-00000000000'||i)::uuid,title,lower(replace(title,' ','-')),'Summary','Description','Skills','Beginner','published',
case when i in(1,3) then '10000000-0000-4000-8000-000000000002'::uuid end
from (values(1,'Amazon'),(2,'Digital Marketing'),(3,'eBay'),(4,'Graphic Designing'),(5,'Shopify')) t(i,title);
select test_assert((select count(*)=2 from instructor_courses),'primary instructor assignments synchronized');
insert into public.enrollments(student_id,course_id,status) values
('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','active'),
('10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003','pending'),
('10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','active');
-- Populate the other tracks as well, so isolation is tested against all five.
insert into public.course_recordings(course_id,title,recording_url,is_published)
select id,title||' private recording','https://example.com/private',true from courses where title in ('Digital Marketing','Graphic Designing','Shopify');
insert into public.live_classes(course_id,title,meeting_url,starts_at,status)
select id,title||' private class','https://meet.google.com/private',now(),'live' from courses where title <> 'eBay';
-- Teacher publishes an eBay class and recording using actual RLS.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
insert into public.live_classes(id,course_id,instructor_id,title,meeting_url,starts_at,status) values
('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','eBay live','https://meet.google.com/ebay',now()-interval '5 minutes','live');
insert into public.course_recordings(id,course_id,author_id,title,recording_url,is_published) values
('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','eBay recording','https://example.com/ebay',true),
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Amazon recording','https://example.com/amazon',true),
('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Draft lecture','https://example.com/draft',false);
select expect_denied($s$insert into course_recordings(course_id,author_id,title,recording_url) values('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','Unassigned','https://example.com/no')$s$);
select expect_denied($s$update course_recordings set course_id='20000000-0000-4000-8000-000000000001' where id='40000000-0000-4000-8000-000000000003'$s$);
update course_recordings set recording_url='https://example.com/ebay-updated' where id='40000000-0000-4000-8000-000000000003';
update live_classes set meeting_url='https://meet.google.com/updated' where id='30000000-0000-4000-8000-000000000003';
-- Student gets ONLY eBay, including the teacher's latest update.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
select test_assert((select count(*)=1 from course_recordings),'only enrolled course recordings visible, drafts hidden');
select test_assert((select recording_url='https://example.com/ebay-updated' from course_recordings),'recording updates visible on refresh');
select test_assert((select count(*)=1 from live_classes),'student sees no class from the other four courses');
select test_assert((select meeting_url='https://meet.google.com/updated' from live_classes),'class joining link update visible');
select test_assert(not exists(select 1 from course_recordings where id='40000000-0000-4000-8000-000000000001'),'guessed other-course recording id denied');
select expect_denied($s$insert into course_recordings(course_id,title,recording_url) values('20000000-0000-4000-8000-000000000003','Student write','https://example.com/no')$s$);
select expect_denied($s$update profiles set role='super_admin' where auth_user_id=auth.uid()$s$);
select expect_denied($s$select manage_course_instructor('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002',true)$s$);
select expect_denied($s$insert into enrollments(student_id,course_id,status) values('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000005','active')$s$);
-- Pending is not approval. Admin can approve a second course and suspend it.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
select test_assert((select count(*)=1 from course_recordings),'pending enrollment grants no eBay access');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
update enrollments set status='active' where student_id='10000000-0000-4000-8000-000000000004' and course_id='20000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
select test_assert((select count(*)=2 from course_recordings),'multiple approved courses visible');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
update enrollments set status='suspended' where student_id='10000000-0000-4000-8000-000000000004' and course_id='20000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
select test_assert((select count(*)=1 from course_recordings),'suspension immediately revokes course access');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select expect_denied($s$update enrollments set starts_at=now(),expires_at=now() where student_id='10000000-0000-4000-8000-000000000003'$s$);
-- Non-active status values all revoke eBay links.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ declare state public.enrollment_status; begin
  foreach state in array array['pending','suspended','completed','expired','cancelled']::public.enrollment_status[] loop
    update public.enrollments set status=state where student_id='10000000-0000-4000-8000-000000000003';
    perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
    perform public.test_assert(not public.has_active_enrollment('20000000-0000-4000-8000-000000000003'), 'non-active status must revoke course access');
    perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  end loop;
  update public.enrollments set status='active' where student_id='10000000-0000-4000-8000-000000000003';
end $$;
-- Expiry and unpublished courses also revoke links.
reset role;
update enrollments set expires_at=now() where student_id='10000000-0000-4000-8000-000000000003';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
select test_assert((select count(*)=0 from course_recordings),'expired student cannot read recordings');
select test_assert((select count(*)=0 from live_classes),'expired student cannot join classes');
reset role;
update enrollments set expires_at=null where student_id='10000000-0000-4000-8000-000000000003';
update courses set status='unpublished' where id='20000000-0000-4000-8000-000000000003';
set role authenticated;
select test_assert((select count(*)=0 from live_classes),'unpublished course class links hidden');
select test_assert((select count(*)=0 from course_recordings),'unpublished course recordings hidden');
reset role;
update courses set status='published' where id='20000000-0000-4000-8000-000000000003';
update enrollments set starts_at=now()+interval '1 day' where student_id='10000000-0000-4000-8000-000000000003';
set role authenticated;
select test_assert((select count(*)=0 from course_recordings),'future enrollment starts grant no recordings');
select test_assert((select count(*)=0 from live_classes),'future enrollment starts grant no class links');
reset role;
update enrollments set starts_at=null where student_id='10000000-0000-4000-8000-000000000003';
update profiles set status='suspended' where id='10000000-0000-4000-8000-000000000003';
set role authenticated;
select test_assert((select count(*)=0 from course_recordings),'suspended student profile cannot access recordings');
-- Admin revocation closes instructor content reads and writes.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select manage_course_instructor('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',false);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select test_assert(not exists(select 1 from course_recordings where course_id='20000000-0000-4000-8000-000000000003'),'teacher revocation closes reads');
with edited as (update live_classes set title='Revoked edit' where id='30000000-0000-4000-8000-000000000003' returning id) select test_assert((select count(*)=0 from edited),'teacher revocation closes updates');
-- Verified registration can link a legacy unclaimed student, but not a teacher.
reset role;
insert into auth.users(id,email,email_confirmed_at) values
('10000000-0000-4000-8000-000000000007','legacy-student@test.invalid',now()),
('10000000-0000-4000-8000-000000000008','legacy-teacher@test.invalid',now());
insert into profiles(id,email,full_name,role) values
('50000000-0000-4000-8000-000000000007','legacy-student@test.invalid','Preserved Student Name','student'),
('50000000-0000-4000-8000-000000000008','legacy-teacher@test.invalid','Preserved Teacher','instructor');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',false);
select test_assert(ensure_student_profile()='50000000-0000-4000-8000-000000000007','verified email links only the matching legacy student');
select test_assert((select full_name='Preserved Student Name' from profiles where auth_user_id=auth.uid()),'registration preserves administrator-managed student details');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
select expect_denied('select ensure_student_profile()');
-- User metadata cannot promote a registration into a teacher/admin.
reset role;
update auth.users set raw_user_meta_data='{"full_name":"New Student","role":"super_admin"}' where email='signup@test.invalid';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
select ensure_student_profile();
select ensure_student_profile();
select test_assert((select role='student' from profiles where auth_user_id=auth.uid()),'registration is student-only and idempotent');
select test_assert((select count(*)=0 from course_recordings),'registration alone grants no course access');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
select expect_denied('select ensure_student_profile()');
reset role;
set role anon;
select expect_denied('select ensure_student_profile()');
select test_assert((select count(*)=0 from course_recordings),'anonymous recording access denied');
select test_assert((select count(*)=0 from live_classes),'anonymous class access denied');
reset role;
select 'PASS: teacher publishing, student isolation, multi-course approval, suspension, expiry, draft/unpublished protection, assignment revocation, registration and role-escalation checks' as result;
