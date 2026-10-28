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
