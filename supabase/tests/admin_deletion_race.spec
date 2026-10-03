# PostgreSQL isolationtester input. Disposable migrated database only.
# Fixtures are committed for cross-session visibility and removed by teardown.
setup
{
  INSERT INTO public.profiles(id, full_name, email, role, status)
    VALUES ('d3110000-0000-4000-8000-000000000001', 'Deletion race admin',
      'admin-deletion-race@example.test', 'super_admin', 'active');
  INSERT INTO public.payment_methods(id, method_type, display_name, account_title, account_number)
    VALUES ('d3110000-0000-4000-8000-000000000002', 'bank_transfer', 'Race bank', 'Race title', '123456');
  INSERT INTO public.courses(id, title, slug, short_description, description, category, level, price, currency)
    VALUES ('d3110000-0000-4000-8000-000000000003', 'Race course', 'admin-deletion-race',
      'Race summary', 'Race description', 'Test', 'All', 100, 'PKR');
}

teardown
{
  DELETE FROM public.audit_logs WHERE entity_id = 'd3110000-0000-4000-8000-000000000002';
  DELETE FROM public.payment_submissions WHERE id = 'd3110000-0000-4000-8000-000000000004';
  DELETE FROM public.payment_methods WHERE id = 'd3110000-0000-4000-8000-000000000002';
  DELETE FROM public.courses WHERE id = 'd3110000-0000-4000-8000-000000000003';
  DELETE FROM public.profiles WHERE id = 'd3110000-0000-4000-8000-000000000001';
}

session "deletion"
step "delete_begin" { BEGIN ISOLATION LEVEL READ COMMITTED; }
step "delete_allowed"
{
  DO $$
  DECLARE deleted boolean;
  BEGIN
    SELECT public.delete_unreferenced_payment_method(id, updated_at,
      'd3110000-0000-4000-8000-000000000001') INTO deleted
      FROM public.payment_methods WHERE id = 'd3110000-0000-4000-8000-000000000002';
    IF deleted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Authorized deletion failed'; END IF;
  END $$;
}
step "delete_denied"
{
  DO $$
  BEGIN
    BEGIN
      PERFORM public.delete_unreferenced_payment_method(id, updated_at,
        'd3110000-0000-4000-8000-000000000001')
        FROM public.payment_methods WHERE id = 'd3110000-0000-4000-8000-000000000002';
      RAISE EXCEPTION 'Concurrent suspension/demotion allowed deletion';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods
      WHERE id = 'd3110000-0000-4000-8000-000000000002')
      OR EXISTS (SELECT 1 FROM public.audit_logs
        WHERE entity_id = 'd3110000-0000-4000-8000-000000000002') THEN
      RAISE EXCEPTION 'Denied deletion changed method/audit';
    END IF;
  END $$;
}
step "delete_commit" { COMMIT; }
step "delete_referenced"
{
  DO $$
  BEGIN
    BEGIN
      PERFORM public.delete_unreferenced_payment_method(id, updated_at,
        'd3110000-0000-4000-8000-000000000001')
        FROM public.payment_methods WHERE id = 'd3110000-0000-4000-8000-000000000002';
      RAISE EXCEPTION 'Concurrent payment reference allowed deletion';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM public.payment_submissions
      WHERE id = 'd3110000-0000-4000-8000-000000000004'
        AND payment_method_id = 'd3110000-0000-4000-8000-000000000002')
      OR NOT EXISTS (SELECT 1 FROM public.payment_methods
        WHERE id = 'd3110000-0000-4000-8000-000000000002')
      OR EXISTS (SELECT 1 FROM public.audit_logs
        WHERE entity_id = 'd3110000-0000-4000-8000-000000000002') THEN
      RAISE EXCEPTION 'Concurrent payment history/method/audit changed';
    END IF;
  END $$;
}

session "profile_change"
step "change_begin" { BEGIN ISOLATION LEVEL READ COMMITTED; }
step "suspend"
{
  UPDATE public.profiles SET status = 'suspended'
    WHERE id = 'd3110000-0000-4000-8000-000000000001';
}
step "demote"
{
  UPDATE public.profiles SET role = 'student'
    WHERE id = 'd3110000-0000-4000-8000-000000000001';
}
step "change_commit" { COMMIT; }

session "payment"
step "payment_begin" { BEGIN ISOLATION LEVEL READ COMMITTED; }
step "payment_insert"
{
  INSERT INTO public.payment_submissions(id, course_id, payment_method_id, amount, currency)
    VALUES ('d3110000-0000-4000-8000-000000000004', 'd3110000-0000-4000-8000-000000000003',
      'd3110000-0000-4000-8000-000000000002', 100, 'PKR');
}
step "payment_denied"
{
  DO $$
  BEGIN
    BEGIN
      INSERT INTO public.payment_submissions(id, course_id, payment_method_id, amount, currency)
        VALUES ('d3110000-0000-4000-8000-000000000004', 'd3110000-0000-4000-8000-000000000003',
          'd3110000-0000-4000-8000-000000000002', 100, 'PKR');
      RAISE EXCEPTION 'Payment accepted a concurrently deleted method';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM public.payment_submissions
      WHERE id = 'd3110000-0000-4000-8000-000000000004') THEN
      RAISE EXCEPTION 'Rejected payment was persisted';
    END IF;
  END $$;
}
step "payment_commit" { COMMIT; }

# The change waits for deletion's transaction, proving the lock outlives the RPC.
permutation "delete_begin" "delete_allowed" "change_begin" "suspend" "delete_commit" "change_commit"
permutation "delete_begin" "delete_allowed" "change_begin" "demote" "delete_commit" "change_commit"
# Deletion waits for the update, then rechecks role/status and raises 42501.
permutation "change_begin" "suspend" "delete_begin" "delete_denied" "change_commit" "delete_commit"
permutation "change_begin" "demote" "delete_begin" "delete_denied" "change_commit" "delete_commit"
# FK enforcement serializes both orders of insertion versus deletion.
permutation "payment_begin" "payment_insert" "delete_begin" "delete_referenced" "payment_commit" "delete_commit"
permutation "delete_begin" "delete_allowed" "payment_begin" "payment_denied" "delete_commit" "payment_commit"
