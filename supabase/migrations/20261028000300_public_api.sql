-- Reference data and the anon-facing API.
-- Anonymous diners never touch tables directly; everything goes through
-- these security-definer functions, which only return public fields.

grant execute on function public.is_super_admin() to anon;

insert into public.templates (key, name, sort) values
  ('pizzeria', 'Pizzeria / Fast food', 1),
  ('cafe', 'Café', 2),
  ('traditionnel', 'Traditionnel', 3),
  ('gastro', 'Gastronomique', 4),
  ('patisserie', 'Pâtisserie / Glacier', 5),
  ('grill', 'Grill', 6),
  ('jus', 'Bar à jus', 7),
  ('mer', 'Fruits de mer', 8),
  ('coffee', 'Coffee shop', 9);

-- Every top-level route name, plus words that would confuse diners.
insert into public.reserved_slugs (slug) values
  ('app'), ('admin'), ('api'), ('dev'), ('tarifs'), ('aide'), ('conditions'), ('confidentialite'),
  ('demo'), ('connexion'), ('inscription'), ('verification'), ('mot-de-passe-oublie'), ('invitation'),
  ('auth'), ('login'), ('signup'), ('register'), ('logout'), ('support'), ('help'), ('contact'),
  ('about'), ('blog'), ('pricing'), ('terms'), ('privacy'), ('legal'), ('static'), ('assets'),
  ('images'), ('icons'), ('fonts'), ('manifest'), ('sw'), ('robots'), ('sitemap'), ('favicon'),
  ('offline'), ('menu'), ('menus'), ('qr'), ('www'), ('mail'), ('status'), ('qaima'), ('test');

-- ---------------------------------------------------------------------------
-- Slugs
-- ---------------------------------------------------------------------------
create or replace function public.slug_is_well_formed(p_slug text)
returns boolean language sql immutable as $$
  select p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and length(p_slug) between 3 and 40
     and p_slug !~ '-menu$'
$$;

-- Available for a new restaurant, or for `p_restaurant_id` to switch to.
-- A restaurant may reclaim one of its own old slugs.
create or replace function public.is_slug_available(p_slug text, p_restaurant_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.slug_is_well_formed(p_slug)
     and not exists (select 1 from public.reserved_slugs where slug = p_slug)
     and not exists (
       select 1 from public.restaurants r
       where r.slug = p_slug and r.id is distinct from p_restaurant_id
     )
     and not exists (
       select 1 from public.slug_history h
       where h.old_slug = p_slug and h.restaurant_id is distinct from p_restaurant_id
     )
$$;

-- Resolves a base slug (without "-menu"). `redirect` is true when the slug
-- is an old one and the caller must 301 to `slug`.
create or replace function public.resolve_public_slug(p_slug text)
returns table (slug text, redirect boolean)
language sql stable security definer set search_path = '' as $$
  select r.slug, false from public.restaurants r
  where r.slug = p_slug and r.deleted_at is null
  union all
  select r.slug, true from public.slug_history h
  join public.restaurants r on r.id = h.restaurant_id and r.deleted_at is null
  where h.old_slug = p_slug
    and not exists (select 1 from public.restaurants r2 where r2.slug = p_slug)
  limit 1
$$;

-- "Did you mean" for the 404 page.
create or replace function public.suggest_restaurants(p_query text)
returns table (slug text, name text, commune text)
language sql stable security definer set search_path = '' as $$
  select r.slug, r.name, r.commune
  from public.restaurants r
  where r.deleted_at is null
    and r.status not in ('suspended')
    and (
      extensions.similarity(r.name, replace(p_query, '-', ' ')) > 0.2
      or extensions.similarity(r.slug, p_query) > 0.3
    )
  order by greatest(
    extensions.similarity(r.name, replace(p_query, '-', ' ')),
    extensions.similarity(r.slug, p_query)
  ) desc
  limit 3
$$;

-- Owner changes the slug: old one is kept in slug_history forever (301s).
create or replace function public.change_slug(p_restaurant_id uuid, p_new_slug text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if not public.can_edit_settings(p_restaurant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.is_slug_available(p_new_slug, p_restaurant_id) then
    raise exception 'slug_unavailable' using errcode = '23505';
  end if;
  select slug into v_old from public.restaurants where id = p_restaurant_id for update;
  if v_old = p_new_slug then return; end if;
  delete from public.slug_history where old_slug = p_new_slug and restaurant_id = p_restaurant_id;
  insert into public.slug_history (restaurant_id, old_slug) values (p_restaurant_id, v_old)
    on conflict (old_slug) do nothing;
  update public.restaurants set slug = p_new_slug where id = p_restaurant_id;
  perform public.write_audit('restaurant.slug_changed', p_restaurant_id, jsonb_build_object('from', v_old, 'to', p_new_slug));
end $$;

-- ---------------------------------------------------------------------------
-- Public menu payload
-- ---------------------------------------------------------------------------
create or replace function public.get_public_menu(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.restaurants%rowtype;
  v_paused boolean;
  v_ordering boolean;
begin
  select * into r from public.restaurants where slug = p_slug and deleted_at is null;
  if not found then
    return null;
  end if;

  v_paused := r.status in ('suspended', 'paused');
  v_ordering := r.orders_enabled
    and r.status in ('trial', 'active', 'grace')
    and r.whatsapp_order_phone is not null
    and (r.delivery_enabled or r.takeaway_enabled);

  return jsonb_build_object(
    'restaurant', jsonb_build_object(
      'id', r.id,
      'slug', r.slug,
      'name', r.name,
      'type', r.type,
      'wilaya_code', r.wilaya_code,
      'commune', r.commune,
      'address', r.address,
      'logo_path', r.logo_path,
      'cover_path', r.cover_path,
      'template_key', r.template_key,
      'primary_color', r.primary_color,
      'default_locale', r.default_locale,
      'enabled_locales', to_jsonb(r.enabled_locales),
      'timezone', r.timezone,
      'status', r.status,
      'is_paused', v_paused,
      'show_powered_by', r.status = 'expired',
      'ordering_available', v_ordering,
      -- The restaurant's own order line is public by design (wa.me link).
      'whatsapp_order_phone', case when v_ordering then r.whatsapp_order_phone end,
      'delivery_enabled', r.delivery_enabled,
      'takeaway_enabled', r.takeaway_enabled,
      'min_order', r.min_order,
      'eta_label', r.eta_label,
      'updated_at', r.updated_at
    ),
    'social', (
      select to_jsonb(s) - 'restaurant_id' - 'created_at' - 'updated_at'
      from public.social_links s where s.restaurant_id = r.id
    ),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', h.opens, 'closes', h.closes) order by h.weekday, h.opens)
      from public.opening_hours h where h.restaurant_id = r.id
    ), '[]'),
    'exceptions', coalesce((
      select jsonb_agg(jsonb_build_object('date', e.date, 'closed', e.closed, 'note', e.note) order by e.date)
      from public.opening_exceptions e
      where e.restaurant_id = r.id and e.date between current_date - 1 and current_date + 60
    ), '[]'),
    'schedules', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'starts', s.starts, 'ends', s.ends, 'weekdays', s.weekdays))
      from public.menu_schedules s where s.restaurant_id = r.id and s.is_active
    ), '[]'),
    'delivery_zones', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'fee', z.fee) order by z.position)
      from public.delivery_zones z where z.restaurant_id = r.id
    ), '[]'),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'code', t.code, 'label', t.label) order by t.position)
      from public.tables t where t.restaurant_id = r.id and t.is_active
    ), '[]'),
    'categories', case when v_paused then '[]'::jsonb else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'icon', c.icon,
          'schedule_id', c.schedule_id,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'base_price', i.base_price,
                'photos', to_jsonb(i.photos),
                'tags', to_jsonb(i.tags),
                'is_sold_out', i.is_sold_out,
                'variants', coalesce((
                  select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price) order by v.position)
                  from public.item_variants v where v.item_id = i.id
                ), '[]'),
                'extras', coalesce((
                  select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'price', x.price) order by x.position)
                  from public.item_extras x where x.item_id = i.id
                ), '[]')
              ) order by i.position, i.created_at
            )
            from public.items i
            where i.category_id = c.id and i.deleted_at is null and i.is_visible
          ), '[]')
        ) order by c.position, c.created_at
      )
      from public.categories c
      where c.restaurant_id = r.id and c.deleted_at is null and c.is_visible
    ), '[]') end
  );
end $$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the call is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- Analytics beacon from public menus (views and item opens).
create or replace function public.log_menu_event(
  p_restaurant_id uuid,
  p_kind public.menu_event_kind,
  p_session_id text,
  p_source public.traffic_source default null,
  p_table_code text default null,
  p_item_id uuid default null
)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_kind not in ('view_table', 'view_order', 'item_view') then
    raise exception 'invalid_kind';
  end if;
  if length(coalesce(p_session_id, '')) not between 8 and 64 then
    raise exception 'invalid_session';
  end if;
  -- 120 events per session per 10 minutes is far above human browsing.
  if not public.hit_rate_limit('evt:' || p_session_id, 120, 600) then
    return;
  end if;
  insert into public.menu_events (restaurant_id, kind, table_id, source, item_id, session_id)
  select r.id, p_kind,
    (select t.id from public.tables t where t.restaurant_id = r.id and t.code = p_table_code),
    p_source,
    (select i.id from public.items i where i.id = p_item_id and i.restaurant_id = r.id),
    p_session_id
  from public.restaurants r
  where r.id = p_restaurant_id and r.deleted_at is null;
end $$;

-- Platform values an owner needs on the billing screen.
create or replace function public.get_billing_settings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'price_monthly', s.price_monthly,
    'price_semiannual', s.price_semiannual,
    'price_annual', s.price_annual,
    'trial_days', s.trial_days,
    'grace_days', s.grace_days,
    'baridimob_rip', s.baridimob_rip,
    'ccp_number', s.ccp_number,
    'ccp_key', s.ccp_key,
    'ccp_holder', s.ccp_holder,
    'kit_price', s.kit_price
  )
  from public.platform_settings s
  where auth.uid() is not null
$$;

grant execute on function
  public.slug_is_well_formed(text),
  public.is_slug_available(text, uuid),
  public.resolve_public_slug(text),
  public.suggest_restaurants(text),
  public.get_public_menu(text),
  public.log_menu_event(uuid, public.menu_event_kind, text, public.traffic_source, text, uuid)
to anon, authenticated;

grant execute on function public.change_slug(uuid, text), public.get_billing_settings() to authenticated;
