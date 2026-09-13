drop policy if exists "skills_public_read_active" on public.skills;
drop policy if exists "skills_admin_all" on public.skills;

drop index if exists public.skills_active_idx;
drop index if exists public.skills_position_idx;
drop index if exists public.skills_slug_idx;

drop table if exists public.skills;
