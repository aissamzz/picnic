-- Phase 6: AI menu import.
-- The server action uploads sources to the private `imports` bucket, opens an
-- import with begin_ai_import (quota + rate limit), runs the extractor and
-- stores the result with the service key. The owner reviews the draft, then
-- apply_ai_import writes real categories, items and sizes.

alter table public.ai_imports add column applied_at timestamptz;
create index ai_imports_restaurant_idx on public.ai_imports (restaurant_id, created_at desc);

-- Opens an import for a restaurant the caller may edit.
-- Trial restaurants get platform_settings.ai_imports_per_trial imports in total
-- (failed ones don't count); everyone is limited to 10 per hour.
create or replace function public.begin_ai_import(p_restaurant_id uuid, p_paths text[])
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_status public.restaurant_status;
  v_limit int;
  v_used int;
  v_id uuid;
begin
  if not public.can_edit_menu(p_restaurant_id) then
    raise exception 'locked' using errcode = '42501';
  end if;
  if coalesce(array_length(p_paths, 1), 0) not between 1 and 5 then
    raise exception 'invalid_sources' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_paths) p where p not like p_restaurant_id::text || '/%') then
    raise exception 'invalid_sources' using errcode = '22023';
  end if;

  select status into v_status from public.restaurants where id = p_restaurant_id;
  if v_status = 'trial' then
    select ai_imports_per_trial into v_limit from public.platform_settings;
    select count(*) into v_used from public.ai_imports where restaurant_id = p_restaurant_id and status <> 'failed';
    if v_used >= v_limit then
      raise exception 'ai_quota' using errcode = 'P0001', detail = v_limit::text;
    end if;
  end if;
  if not public.hit_rate_limit('ai-import:' || p_restaurant_id, 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.ai_imports (restaurant_id, source_paths, created_by)
  values (p_restaurant_id, p_paths, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Imports left for a trial restaurant (null = unlimited).
create or replace function public.ai_imports_left(p_restaurant_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when r.status = 'trial'
    then greatest(0, s.ai_imports_per_trial - (
      select count(*)::int from public.ai_imports i where i.restaurant_id = r.id and i.status <> 'failed'))
  end
  from public.restaurants r, public.platform_settings s
  where r.id = p_restaurant_id and public.is_member(r.id)
$$;

-- Writes a reviewed draft into the menu. Categories are matched by name
-- (French or Arabic, case-insensitive) so a second import adds to them.
-- p_draft: {categories: [{name: {fr, ar}, items: [{name, description, price, variants: [{name, price}]}]}]}
-- Returns the number of items created.
create or replace function public.apply_ai_import(p_import_id uuid, p_draft jsonb)
returns int language plpgsql volatile as $$
declare
  v_rid uuid;
  v_cat jsonb;
  v_item jsonb;
  v_cat_id uuid;
  v_count int := 0;
  v_name jsonb;
begin
  select restaurant_id into v_rid from public.ai_imports
  where id = p_import_id and status = 'done' and applied_at is null;
  if v_rid is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.assert_can_edit_menu(v_rid);

  for v_cat in select value from jsonb_array_elements(coalesce(p_draft -> 'categories', '[]')) loop
    v_name := jsonb_strip_nulls(jsonb_build_object(
      'fr', nullif(btrim(v_cat -> 'name' ->> 'fr'), ''),
      'ar', nullif(btrim(v_cat -> 'name' ->> 'ar'), '')));
    continue when v_name = '{}'::jsonb or jsonb_array_length(coalesce(v_cat -> 'items', '[]')) = 0;

    select c.id into v_cat_id from public.categories c
    where c.restaurant_id = v_rid and c.deleted_at is null
      and ((v_name ? 'fr' and lower(c.name ->> 'fr') = lower(v_name ->> 'fr'))
        or (v_name ? 'ar' and c.name ->> 'ar' = v_name ->> 'ar'))
    order by c.position limit 1;

    if v_cat_id is null then
      insert into public.categories (restaurant_id, name, position)
      values (v_rid, v_name, coalesce((select max(position) + 1 from public.categories where restaurant_id = v_rid and deleted_at is null), 1))
      returning id into v_cat_id;
    end if;

    for v_item in select value from jsonb_array_elements(v_cat -> 'items') loop
      continue when coalesce(nullif(btrim(v_item -> 'name' ->> 'fr'), ''), nullif(btrim(v_item -> 'name' ->> 'ar'), '')) is null;
      perform public.save_item(v_rid, jsonb_build_object(
        'category_id', v_cat_id,
        'name', jsonb_strip_nulls(jsonb_build_object(
          'fr', nullif(btrim(v_item -> 'name' ->> 'fr'), ''),
          'ar', nullif(btrim(v_item -> 'name' ->> 'ar'), ''))),
        'description', jsonb_strip_nulls(jsonb_build_object(
          'fr', nullif(btrim(v_item -> 'description' ->> 'fr'), ''),
          'ar', nullif(btrim(v_item -> 'description' ->> 'ar'), ''))),
        'base_price', v_item -> 'price',
        'variants', coalesce((
          select jsonb_agg(jsonb_build_object('name', jsonb_strip_nulls(jsonb_build_object(
              'fr', nullif(btrim(v.value -> 'name' ->> 'fr'), ''),
              'ar', nullif(btrim(v.value -> 'name' ->> 'ar'), ''))), 'price', coalesce((v.value ->> 'price')::int, 0)))
          from jsonb_array_elements(coalesce(v_item -> 'variants', '[]')) v
          where coalesce(nullif(btrim(v.value -> 'name' ->> 'fr'), ''), nullif(btrim(v.value -> 'name' ->> 'ar'), '')) is not null), '[]')));
      v_count := v_count + 1;
    end loop;
    v_cat_id := null;
  end loop;

  update public.ai_imports set applied_at = now() where id = p_import_id;
  return v_count;
end $$;

grant update (applied_at) on public.ai_imports to authenticated;
create policy ai_imports_apply on public.ai_imports for update to authenticated
  using (public.can_edit_menu(restaurant_id)) with check (public.can_edit_menu(restaurant_id));

revoke execute on function public.begin_ai_import(uuid, text[]), public.ai_imports_left(uuid), public.apply_ai_import(uuid, jsonb) from public, anon;
grant execute on function public.begin_ai_import(uuid, text[]), public.ai_imports_left(uuid), public.apply_ai_import(uuid, jsonb) to authenticated;
