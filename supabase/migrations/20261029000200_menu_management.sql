-- Phase 4: owner menu management.
-- These functions are SECURITY INVOKER: they only bundle several writes into
-- one transaction. RLS (membership + subscription lock) still decides.

alter table public.items add constraint items_photos_max check (cardinality(photos) <= 4);

-- Raises 42501 'locked' when the caller can't edit this restaurant's menu.
create or replace function public.assert_can_edit_menu(p_restaurant_id uuid)
returns void language plpgsql stable as $$
begin
  if not public.can_edit_menu(p_restaurant_id) then
    raise exception 'locked' using errcode = '42501';
  end if;
end $$;

-- Create or update an item with its variants and extras in one go.
-- p_item: {id?, category_id, name, description, base_price, tags, is_sold_out,
--          is_visible, photos, variants: [{name, price}], extras: [{name, price}]}
create or replace function public.save_item(p_restaurant_id uuid, p_item jsonb)
returns uuid language plpgsql volatile as $$
declare
  v_id uuid := nullif(p_item ->> 'id', '')::uuid;
  v_category uuid := (p_item ->> 'category_id')::uuid;
begin
  perform public.assert_can_edit_menu(p_restaurant_id);
  if v_id is null then
    insert into public.items (restaurant_id, category_id, name, description, base_price, tags, is_sold_out, is_visible, photos, position)
    values (
      p_restaurant_id, v_category, p_item -> 'name', coalesce(p_item -> 'description', '{}'),
      (p_item ->> 'base_price')::int,
      coalesce(array(select jsonb_array_elements_text(p_item -> 'tags'))::public.item_tag[], '{}'),
      coalesce((p_item ->> 'is_sold_out')::boolean, false),
      coalesce((p_item ->> 'is_visible')::boolean, true),
      coalesce(array(select jsonb_array_elements_text(p_item -> 'photos')), '{}'),
      coalesce((select max(position) + 1 from public.items where category_id = v_category and deleted_at is null), 1)
    )
    returning id into v_id;
  else
    update public.items set
      category_id = v_category,
      name = p_item -> 'name',
      description = coalesce(p_item -> 'description', '{}'),
      base_price = (p_item ->> 'base_price')::int,
      tags = coalesce(array(select jsonb_array_elements_text(p_item -> 'tags'))::public.item_tag[], '{}'),
      is_sold_out = coalesce((p_item ->> 'is_sold_out')::boolean, false),
      is_visible = coalesce((p_item ->> 'is_visible')::boolean, true),
      photos = coalesce(array(select jsonb_array_elements_text(p_item -> 'photos')), '{}')
    where id = v_id and restaurant_id = p_restaurant_id and deleted_at is null;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    delete from public.item_variants where item_id = v_id;
    delete from public.item_extras where item_id = v_id;
  end if;

  insert into public.item_variants (item_id, restaurant_id, name, price, position)
  select v_id, p_restaurant_id, v.value -> 'name', (v.value ->> 'price')::int, v.ordinality
  from jsonb_array_elements(coalesce(p_item -> 'variants', '[]')) with ordinality v;

  insert into public.item_extras (item_id, restaurant_id, name, price, position)
  select v_id, p_restaurant_id, x.value -> 'name', coalesce((x.value ->> 'price')::int, 0), x.ordinality
  from jsonb_array_elements(coalesce(p_item -> 'extras', '[]')) with ordinality x;

  return v_id;
end $$;

create or replace function public.reorder_categories(p_restaurant_id uuid, p_ids uuid[])
returns void language plpgsql volatile as $$
begin
  perform public.assert_can_edit_menu(p_restaurant_id);
  update public.categories c set position = o.pos
  from unnest(p_ids) with ordinality o(id, pos)
  where c.id = o.id and c.restaurant_id = p_restaurant_id;
end $$;

create or replace function public.reorder_items(p_restaurant_id uuid, p_ids uuid[])
returns void language plpgsql volatile as $$
begin
  perform public.assert_can_edit_menu(p_restaurant_id);
  update public.items i set position = o.pos
  from unnest(p_ids) with ordinality o(id, pos)
  where i.id = o.id and i.restaurant_id = p_restaurant_id;
end $$;

-- Quick price screen. p_rows: [{item_id, base_price, variants: [{id, price}]}]
create or replace function public.set_prices(p_restaurant_id uuid, p_rows jsonb)
returns int language plpgsql volatile as $$
declare v_count int;
begin
  perform public.assert_can_edit_menu(p_restaurant_id);
  update public.items i set base_price = (r.value ->> 'base_price')::int
  from jsonb_array_elements(p_rows) r
  where i.id = (r.value ->> 'item_id')::uuid and i.restaurant_id = p_restaurant_id
    and i.base_price is distinct from (r.value ->> 'base_price')::int;
  get diagnostics v_count = row_count;

  update public.item_variants v set price = (x.value ->> 'price')::int
  from jsonb_array_elements(p_rows) r, jsonb_array_elements(coalesce(r.value -> 'variants', '[]')) x
  where v.id = (x.value ->> 'id')::uuid and v.restaurant_id = p_restaurant_id
    and v.price <> (x.value ->> 'price')::int;
  return v_count;
end $$;

-- "+X DA" on a category (or the whole menu). Never below 0. Returns items touched.
create or replace function public.bump_prices(p_restaurant_id uuid, p_delta int, p_category_id uuid default null)
returns int language plpgsql volatile as $$
declare v_count int;
begin
  perform public.assert_can_edit_menu(p_restaurant_id);
  if p_delta = 0 or abs(p_delta) > 100000 then raise exception 'invalid_delta'; end if;
  update public.items set base_price = greatest(0, base_price + p_delta)
  where restaurant_id = p_restaurant_id and deleted_at is null and base_price is not null
    and (p_category_id is null or category_id = p_category_id);
  get diagnostics v_count = row_count;
  update public.item_variants v set price = greatest(0, v.price + p_delta)
  from public.items i
  where v.item_id = i.id and i.restaurant_id = p_restaurant_id and i.deleted_at is null
    and (p_category_id is null or i.category_id = p_category_id);
  return v_count;
end $$;

-- Translation screen. p_rows: [{kind: category|item|variant|extra, id, field: name|description, fr, ar}]
create or replace function public.save_translations(p_restaurant_id uuid, p_rows jsonb)
returns int language plpgsql volatile as $$
declare
  r jsonb;
  v_text jsonb;
  v_count int := 0;
begin
  perform public.assert_can_edit_menu(p_restaurant_id);
  for r in select * from jsonb_array_elements(p_rows) loop
    v_text := jsonb_strip_nulls(jsonb_build_object('fr', nullif(btrim(r ->> 'fr'), ''), 'ar', nullif(btrim(r ->> 'ar'), '')));
    if r ->> 'field' = 'name' and v_text = '{}'::jsonb then continue; end if; -- a name can't become empty
    case r ->> 'kind'
      when 'category' then
        update public.categories set name = v_text where id = (r ->> 'id')::uuid and restaurant_id = p_restaurant_id;
      when 'item' then
        if r ->> 'field' = 'description' then
          update public.items set description = v_text where id = (r ->> 'id')::uuid and restaurant_id = p_restaurant_id;
        else
          update public.items set name = v_text where id = (r ->> 'id')::uuid and restaurant_id = p_restaurant_id;
        end if;
      when 'variant' then
        update public.item_variants set name = v_text where id = (r ->> 'id')::uuid and restaurant_id = p_restaurant_id;
      when 'extra' then
        update public.item_extras set name = v_text where id = (r ->> 'id')::uuid and restaurant_id = p_restaurant_id;
      else
        raise exception 'invalid_kind';
    end case;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Share hub: visits per link and source over the last p_days days.
create or replace function public.channel_stats(p_restaurant_id uuid, p_days int default 7)
returns table (kind public.menu_event_kind, source public.traffic_source, visits bigint)
language sql stable as $$
  select e.kind, e.source, count(*)
  from public.menu_events e
  where e.restaurant_id = p_restaurant_id
    and e.kind in ('view_table', 'view_order')
    and e.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by e.kind, e.source
$$;

grant execute on function
  public.assert_can_edit_menu(uuid),
  public.save_item(uuid, jsonb),
  public.reorder_categories(uuid, uuid[]),
  public.reorder_items(uuid, uuid[]),
  public.set_prices(uuid, jsonb),
  public.bump_prices(uuid, int, uuid),
  public.save_translations(uuid, jsonb),
  public.channel_stats(uuid, int)
to authenticated;
