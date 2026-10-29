-- Phase 5: diner orders (WhatsApp hand-off), fake-order flagging, waiter calls, stats.

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

-- Places an order from the public order link. Every price comes from the
-- database (the cart is never trusted). Returns the priced snapshot used to
-- build the WhatsApp message.
--
-- p_order: {mode, customer_name, customer_phone, address, zone_id, note,
--           locale, source, session_id,
--           items: [{item_id, variant_id, extra_ids: [], qty}]}
create or replace function public.submit_order(p_restaurant_id uuid, p_order jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.restaurants%rowtype;
  v_mode public.order_mode := (p_order ->> 'mode')::public.order_mode;
  v_phone text := btrim(p_order ->> 'customer_phone');
  v_name text := btrim(p_order ->> 'customer_name');
  v_address text := nullif(btrim(coalesce(p_order ->> 'address', '')), '');
  v_note text := nullif(btrim(coalesce(p_order ->> 'note', '')), '');
  v_session text := coalesce(p_order ->> 'session_id', '');
  v_source public.traffic_source;
  v_zone public.delivery_zones%rowtype;
  v_line jsonb;
  v_item record;
  v_variant_name jsonb;
  v_extras jsonb;
  v_extras_total int;
  v_unit int;
  v_qty int;
  v_lines jsonb := '[]';
  v_subtotal int := 0;
  v_fee int := 0;
  v_order public.orders%rowtype;
begin
  select * into r from public.restaurants where id = p_restaurant_id and deleted_at is null;
  if not found
     or not r.orders_enabled
     or r.status not in ('trial', 'active', 'grace')
     or r.whatsapp_order_phone is null then
    raise exception 'ordering_unavailable';
  end if;
  if (v_mode = 'delivery' and not r.delivery_enabled) or (v_mode = 'takeaway' and not r.takeaway_enabled) then
    raise exception 'mode_unavailable';
  end if;
  if v_phone !~ '^\+213[0-9]{8,9}$' then raise exception 'invalid_phone'; end if;
  if length(coalesce(v_name, '')) not between 2 and 60 then raise exception 'invalid_name'; end if;
  if length(coalesce(v_note, '')) > 300 or length(coalesce(v_address, '')) > 200 then raise exception 'too_long'; end if;
  if length(v_session) not between 8 and 64 then raise exception 'invalid_session'; end if;

  if exists (select 1 from public.blocked_phones where phone = v_phone and blocked_at is not null) then
    raise exception 'phone_blocked';
  end if;
  if not public.hit_rate_limit('order:' || v_phone, 5, 600) or not public.hit_rate_limit('order-s:' || v_session, 8, 600) then
    raise exception 'rate_limited';
  end if;

  if jsonb_typeof(p_order -> 'items') <> 'array' or jsonb_array_length(p_order -> 'items') not between 1 and 50 then
    raise exception 'empty_cart';
  end if;

  for v_line in select * from jsonb_array_elements(p_order -> 'items') loop
    v_qty := (v_line ->> 'qty')::int;
    if v_qty is null or v_qty not between 1 and 50 then raise exception 'invalid_quantity'; end if;

    select i.id, i.name, i.base_price into v_item
    from public.items i join public.categories c on c.id = i.category_id
    where i.id = (v_line ->> 'item_id')::uuid and i.restaurant_id = r.id
      and i.deleted_at is null and i.is_visible and not i.is_sold_out
      and c.deleted_at is null and c.is_visible;
    if not found then raise exception 'item_unavailable' using detail = coalesce(v_line ->> 'item_id', ''); end if;

    v_variant_name := null;
    if nullif(v_line ->> 'variant_id', '') is not null then
      select v.name, v.price into v_variant_name, v_unit from public.item_variants v
      where v.id = (v_line ->> 'variant_id')::uuid and v.item_id = v_item.id;
      if not found then raise exception 'item_unavailable' using detail = v_item.id::text; end if;
    elsif exists (select 1 from public.item_variants where item_id = v_item.id) then
      raise exception 'variant_required' using detail = v_item.id::text;
    else
      v_unit := v_item.base_price;
    end if;
    if v_unit is null then raise exception 'item_unavailable' using detail = v_item.id::text; end if;

    select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'price', x.price) order by x.position), '[]'), coalesce(sum(x.price), 0)
    into v_extras, v_extras_total
    from public.item_extras x
    where x.item_id = v_item.id
      and x.id in (select (e)::uuid from jsonb_array_elements_text(coalesce(v_line -> 'extra_ids', '[]')) e);
    if jsonb_array_length(v_extras) <> jsonb_array_length(coalesce(v_line -> 'extra_ids', '[]')) then
      raise exception 'item_unavailable' using detail = v_item.id::text;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'item_id', v_item.id,
      'name', v_item.name,
      'variant', v_variant_name,
      'extras', v_extras,
      'unit_price', v_unit + v_extras_total,
      'qty', v_qty,
      'line_total', (v_unit + v_extras_total) * v_qty
    );
    v_subtotal := v_subtotal + (v_unit + v_extras_total) * v_qty;
  end loop;

  if v_subtotal < r.min_order then
    raise exception 'below_minimum' using detail = r.min_order::text;
  end if;

  if v_mode = 'delivery' then
    if v_address is null then raise exception 'address_required'; end if;
    if exists (select 1 from public.delivery_zones where restaurant_id = r.id) then
      select * into v_zone from public.delivery_zones
      where id = nullif(p_order ->> 'zone_id', '')::uuid and restaurant_id = r.id;
      if not found then raise exception 'zone_required'; end if;
      v_fee := v_zone.fee;
    end if;
  end if;

  v_source := case when p_order ->> 'source' in ('instagram', 'facebook', 'tiktok', 'poster', 'direct', 'whatsapp')
                   then (p_order ->> 'source')::public.traffic_source else 'direct' end;

  insert into public.orders (restaurant_id, mode, customer_name, customer_phone, address, zone_id, note, items, subtotal, delivery_fee, locale, source)
  values (r.id, v_mode, v_name, v_phone, case when v_mode = 'delivery' then v_address end, v_zone.id, v_note, v_lines, v_subtotal, v_fee,
          case when p_order ->> 'locale' = 'ar' then 'ar' else 'fr' end, v_source)
  returning * into v_order;

  insert into public.menu_events (restaurant_id, kind, source, session_id)
  values (r.id, 'order_sent', v_source, v_session);

  return jsonb_build_object(
    'public_id', v_order.public_id,
    'restaurant_name', r.name,
    'whatsapp', r.whatsapp_order_phone,
    'mode', v_mode,
    'items', v_lines,
    'subtotal', v_subtotal,
    'delivery_fee', v_fee,
    'total', v_subtotal + v_fee,
    'zone_name', v_zone.name,
    'eta_label', r.eta_label
  );
end $$;

-- Owner/staff marks an order as fake (or undoes it). Reports add up per
-- phone; at platform_settings.block_after_reports the phone is blocked
-- everywhere.
create or replace function public.flag_order(p_order_id uuid, p_fake boolean)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.orders%rowtype;
  v_threshold int;
  v_reports int;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or not public.is_member(o.restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_fake = (o.status = 'flagged_fake') then return o.status::text; end if;

  select block_after_reports into v_threshold from public.platform_settings;
  update public.orders set status = case when p_fake then 'flagged_fake' else 'sent' end::public.order_status where id = o.id;

  insert into public.blocked_phones (phone, reason, reports)
  values (o.customer_phone, 'fake_order', case when p_fake then 1 else 0 end)
  on conflict (phone) do update set reports = greatest(0, public.blocked_phones.reports + case when p_fake then 1 else -1 end)
  returning reports into v_reports;

  update public.blocked_phones
  set blocked_at = case when v_reports >= v_threshold then coalesce(blocked_at, now()) else null end
  where phone = o.customer_phone;

  perform public.write_audit(case when p_fake then 'order.flagged_fake' else 'order.unflagged' end, o.restaurant_id,
    jsonb_build_object('order_id', o.id, 'reports', v_reports));
  return case when p_fake then 'flagged_fake' else 'sent' end;
end $$;

-- ---------------------------------------------------------------------------
-- Waiter calls
-- ---------------------------------------------------------------------------

-- From a table QR: one open call per table and kind within the cooldown.
-- Returns {status: sent|cooldown, retry_after: seconds}.
create or replace function public.call_waiter(p_restaurant_id uuid, p_table_code text, p_kind public.waiter_call_kind, p_session_id text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_table public.tables%rowtype;
  v_cooldown int;
  v_last timestamptz;
begin
  select t.* into v_table from public.tables t join public.restaurants r on r.id = t.restaurant_id
  where t.restaurant_id = p_restaurant_id and upper(t.code) = upper(p_table_code) and t.is_active
    and r.deleted_at is null and r.status not in ('paused', 'suspended');
  if not found then raise exception 'table_unknown'; end if;
  if length(coalesce(p_session_id, '')) not between 8 and 64 then raise exception 'invalid_session'; end if;

  select waiter_call_cooldown_sec into v_cooldown from public.platform_settings;
  select max(created_at) into v_last from public.waiter_calls
  where table_id = v_table.id and kind = p_kind and created_at > now() - make_interval(secs => v_cooldown);
  if v_last is not null then
    return jsonb_build_object('status', 'cooldown', 'retry_after', ceil(extract(epoch from v_last + make_interval(secs => v_cooldown) - now()))::int);
  end if;
  if not public.hit_rate_limit('call:' || p_session_id, 10, 600) then raise exception 'rate_limited'; end if;

  insert into public.waiter_calls (restaurant_id, table_id, kind) values (v_table.restaurant_id, v_table.id, p_kind);
  insert into public.menu_events (restaurant_id, kind, table_id, source, session_id)
  values (v_table.restaurant_id, 'waiter_call', v_table.id, 'table', p_session_id);
  return jsonb_build_object('status', 'sent', 'retry_after', v_cooldown);
end $$;

-- "J'y vais": records who handles the call.
create or replace function public.handle_waiter_call(p_call_id uuid)
returns boolean language plpgsql volatile as $$
begin
  update public.waiter_calls set status = 'handled', handled_by = auth.uid(), handled_at = now()
  where id = p_call_id and status = 'open';
  return found;
end $$;

-- Live updates for /app/appels (RLS on waiter_calls applies to Realtime too).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.waiter_calls;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Stats (owner and staff)
-- ---------------------------------------------------------------------------
create or replace function public.restaurant_stats(p_restaurant_id uuid, p_days int default 7)
returns jsonb language plpgsql stable as $$
declare
  v_tz text;
  v_since timestamptz;
begin
  select timezone into v_tz from public.restaurants where id = p_restaurant_id;
  if v_tz is null then return null; end if; -- not visible to the caller
  v_since := date_trunc('day', now() at time zone v_tz) at time zone v_tz - make_interval(days => least(greatest(p_days, 1), 90) - 1);

  return jsonb_build_object(
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'table', coalesce(t, 0), 'order', coalesce(o, 0), 'orders', coalesce(s, 0)) order by d), '[]')
      from generate_series(v_since at time zone v_tz, now() at time zone v_tz, interval '1 day') d
      left join (
        select (e.created_at at time zone v_tz)::date as day,
               count(*) filter (where e.kind = 'view_table') t,
               count(*) filter (where e.kind = 'view_order') o,
               count(*) filter (where e.kind = 'order_sent') s
        from public.menu_events e
        where e.restaurant_id = p_restaurant_id and e.created_at >= v_since
        group by 1
      ) x on x.day = d::date
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source, 'visits', n) order by n desc), '[]')
      from (
        select case when kind = 'view_table' then 'table' else coalesce(source::text, 'direct') end as source, count(*) n
        from public.menu_events
        where restaurant_id = p_restaurant_id and created_at >= v_since and kind in ('view_table', 'view_order')
        group by 1
      ) s
    ),
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'visits', n, 'calls', c) order by n desc), '[]')
      from (
        select t.label,
               count(*) filter (where e.kind = 'view_table') n,
               count(*) filter (where e.kind = 'waiter_call') c
        from public.menu_events e join public.tables t on t.id = e.table_id
        where e.restaurant_id = p_restaurant_id and e.created_at >= v_since
        group by t.id, t.label
        limit 50
      ) s
    ),
    'top_items', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'views', n) order by n desc), '[]')
      from (
        select i.name, count(*) n
        from public.menu_events e join public.items i on i.id = e.item_id
        where e.restaurant_id = p_restaurant_id and e.created_at >= v_since and e.kind = 'item_view'
        group by i.id, i.name
        order by n desc
        limit 10
      ) s
    ),
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'visits', coalesce(n, 0)) order by h), '[]')
      from generate_series(0, 23) h
      left join (
        select extract(hour from created_at at time zone v_tz)::int hr, count(*) n
        from public.menu_events
        where restaurant_id = p_restaurant_id and created_at >= v_since and kind in ('view_table', 'view_order')
        group by 1
      ) x on x.hr = h
    ),
    'orders', (
      select jsonb_build_object(
        'count', count(*) filter (where status = 'sent'),
        'flagged', count(*) filter (where status = 'flagged_fake'),
        'total', coalesce(sum(subtotal + delivery_fee) filter (where status = 'sent'), 0)
      )
      from public.orders where restaurant_id = p_restaurant_id and created_at >= v_since
    ),
    'calls', (select count(*) from public.waiter_calls where restaurant_id = p_restaurant_id and created_at >= v_since)
  );
end $$;

grant execute on function public.submit_order(uuid, jsonb), public.call_waiter(uuid, text, public.waiter_call_kind, text) to anon, authenticated;
grant execute on function public.flag_order(uuid, boolean), public.handle_waiter_call(uuid), public.restaurant_stats(uuid, int) to authenticated;
