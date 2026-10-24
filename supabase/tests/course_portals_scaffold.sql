-- Only for the disposable local cluster created by scripts/test-course-portals.mjs.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_admin nologin;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz, encrypted_password text, deleted_at timestamptz, banned_until timestamptz, last_sign_in_at timestamptz, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant select on auth.users to service_role;
alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
