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
