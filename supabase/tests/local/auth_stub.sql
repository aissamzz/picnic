-- auth.users and JWT helpers, normally created by Supabase Auth (GoTrue).
-- Test database only: the dev stack runs real GoTrue migrations instead.

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

