-- Roles and schemas a Supabase Postgres provides. Used by the throwaway test
-- database (run-local.sh) and the Docker-free dev stack (scripts/local-stack).
-- NOT used against a real Supabase project.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
-- PostgREST connects as authenticator and switches to anon/authenticated/service_role.
create role authenticator login noinherit password 'authenticator';
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to current_user;

create schema extensions;
create schema auth;
-- Supabase Auth (GoTrue) connects as supabase_auth_admin and owns the auth schema.
create role supabase_auth_admin login noinherit createrole password 'auth';
alter role supabase_auth_admin set search_path = auth;
alter schema auth owner to supabase_auth_admin;
create schema storage;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

-- Storage stand-in (the dev stack serves files from disk; see scripts/local-stack/gateway.mjs).
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to anon, authenticated;

