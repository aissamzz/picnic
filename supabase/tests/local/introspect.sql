-- Emits the public schema as JSON for scripts/gen-db-types.mjs.
select json_build_object(
  'tables', (
    select json_agg(json_build_object(
      'name', c.relname,
      'kind', case c.relkind when 'v' then 'view' else 'table' end,
      'columns', (
        select json_agg(json_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'udt', t.typname,
          'elem', et.typname,
          'nullable', not a.attnotnull,
          'has_default', a.atthasdef or a.attidentity <> '',
          'generated', a.attgenerated <> ''
        ) order by a.attnum)
        from pg_attribute a
        join pg_type t on t.oid = a.atttypid
        left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      )
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'p')
  ),
  'enums', (
    select json_object_agg(t.typname, (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  ),
  'functions', (
    select json_agg(json_build_object(
      'name', p.proname,
      'args', (
        select json_agg(json_build_object(
          'name', p.proargnames[i],
          'udt', (select typname from pg_type where oid = p.proargtypes[i - 1]),
          'optional', i > p.pronargs - p.pronargdefaults
        ) order by i)
        from generate_series(1, p.pronargs) i
      ),
      'returns', (select typname from pg_type where oid = p.prorettype),
      'returns_set', p.proretset,
      'out_cols', (
        select json_agg(json_build_object('name', p.proargnames[i], 'udt', (select typname from pg_type where oid = p.proallargtypes[i])) order by i)
        from generate_series(1, coalesce(array_length(p.proallargtypes, 1), 0)) i
        where p.proargmodes[i] = 't'
      )
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.prorettype <> 'trigger'::regtype
      and p.proname not in ('plan', 'ok', 'is', 'throws_ok', 'lives_ok', 'finish')
  )
);
