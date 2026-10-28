-- Minimal stand-in for what a Supabase Postgres provides, so migrations and
-- RLS tests can run against a plain local Postgres (CI or no Docker).
-- NOT used against a real Supabase project.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant anon, authenticated, service_role to current_user;

create schema extensions;
create schema auth;
create schema storage;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  email text,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

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

-- Tiny pgTAP subset: plan / ok / is / throws_ok / lives_ok / finish.
-- Failures raise immediately so the runner exits non-zero.
create schema tap;
create table tap.state (n int not null default 0, planned int);
insert into tap.state values (0, null);
grant usage on schema tap to anon, authenticated, service_role;
grant select, update on tap.state to anon, authenticated, service_role;

create function public.plan(n int) returns text language sql as $$
  update tap.state set planned = plan.n, n = 0 returning '1..' || planned
$$;
create function public.ok(cond boolean, descr text) returns text language plpgsql as $$
declare v int;
begin
  update tap.state set n = n + 1 returning n into v;
  if cond is not true then
    raise exception 'not ok % - %', v, descr;
  end if;
  return format('ok %s - %s', v, descr);
end $$;
create function public."is"(have anyelement, want anyelement, descr text) returns text language plpgsql as $$
begin
  if have is distinct from want then
    raise exception 'not ok - % (have %, want %)', descr, have, want;
  end if;
  return public.ok(true, descr);
end $$;
create function public.throws_ok(sql text, errcode text, msg text, descr text) returns text language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if errcode is null or sqlstate = errcode then
      return public.ok(true, descr);
    end if;
    raise exception 'not ok - % (got sqlstate %: %)', descr, sqlstate, sqlerrm;
  end;
  raise exception 'not ok - % (no error raised)', descr;
end $$;
create function public.lives_ok(sql text, descr text) returns text language plpgsql as $$
begin
  execute sql;
  return public.ok(true, descr);
exception when others then
  raise exception 'not ok - % (%: %)', descr, sqlstate, sqlerrm;
end $$;
create function public.finish() returns setof text language plpgsql as $$
declare s tap.state;
begin
  select * into s from tap.state;
  if s.planned is not null and s.planned <> s.n then
    raise exception 'planned % tests but ran %', s.planned, s.n;
  end if;
  return next format('# %s tests passed', s.n);
end $$;
grant execute on function public.plan(int), public.ok(boolean, text), public."is"(anyelement, anyelement, text),
  public.throws_ok(text, text, text, text), public.lives_ok(text, text), public.finish() to anon, authenticated, service_role;
