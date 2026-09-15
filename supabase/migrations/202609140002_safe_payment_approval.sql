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
