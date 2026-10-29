-- Phase 9: team invites, hours and links settings, nightly maintenance.

-- ---------------------------------------------------------------------------
-- Team: owners invite staff by phone; the invite is a share link.
-- ---------------------------------------------------------------------------
create or replace function public.invite_staff(p_restaurant_id uuid, p_phone text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_token text;
begin
  if not public.can_edit_settings(p_restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_phone !~ '^\+213[5-7][0-9]{8}$' then raise exception 'phone_invalid'; end if;
  if exists (
    select 1 from public.restaurant_members m join public.profiles p on p.id = m.user_id
    where m.restaurant_id = p_restaurant_id and m.invite_status = 'accepted' and p.phone = p_phone
  ) then raise exception 'already_member'; end if;
  -- Same phone invited again: same link.
  select invite_token into v_token from public.restaurant_members
  where restaurant_id = p_restaurant_id and invited_phone = p_phone and invite_status = 'pending';
  if v_token is not null then return v_token; end if;
  if (select count(*) from public.restaurant_members where restaurant_id = p_restaurant_id and role = 'staff') >= 20 then
    raise exception 'team_full';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.restaurant_members (restaurant_id, role, invited_phone, invite_token, invite_status)
  values (p_restaurant_id, 'staff', p_phone, v_token, 'pending');
  perform public.write_audit('member.invited', p_restaurant_id, jsonb_build_object('phone', p_phone));
  return v_token;
end $$;

create or replace function public.remove_member(p_member_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare m public.restaurant_members;
begin
  select * into m from public.restaurant_members where id = p_member_id for update;
  if not found or not public.is_owner(m.restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if m.role <> 'staff' then raise exception 'cannot_remove_owner'; end if;
  delete from public.restaurant_members where id = p_member_id;
  perform public.write_audit(case when m.invite_status = 'pending' then 'member.invite_cancelled' else 'member.removed' end,
    m.restaurant_id, jsonb_build_object('user_id', m.user_id, 'phone', m.invited_phone));
end $$;

-- Team list for owners: members with their name and phone, pending invites.
create or replace function public.team_members(p_restaurant_id uuid)
returns table (id uuid, role public.member_role, status public.invite_status, full_name text, phone text, invite_token text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.role, m.invite_status, p.full_name, coalesce(p.phone, m.invited_phone), m.invite_token, m.created_at
  from public.restaurant_members m left join public.profiles p on p.id = m.user_id
  where m.restaurant_id = p_restaurant_id and public.is_owner(p_restaurant_id)
  order by m.role, m.created_at
$$;

-- ---------------------------------------------------------------------------
-- Hours, exceptions and links, saved in one go (RLS applies: invoker).
-- p_hours: [{weekday, opens, closes}], p_exceptions: [{date, closed, note}], p_links: {instagram, ...}
-- ---------------------------------------------------------------------------
create or replace function public.save_hours_and_links(p_restaurant_id uuid, p_hours jsonb, p_exceptions jsonb, p_links jsonb)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  if not public.can_edit_settings(p_restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.opening_hours where restaurant_id = p_restaurant_id;
  insert into public.opening_hours (restaurant_id, weekday, opens, closes)
  select p_restaurant_id, (h ->> 'weekday')::smallint, (h ->> 'opens')::time, (h ->> 'closes')::time
  from jsonb_array_elements(coalesce(p_hours, '[]')) h;
  delete from public.opening_exceptions where restaurant_id = p_restaurant_id;
  insert into public.opening_exceptions (restaurant_id, date, closed, note)
  select p_restaurant_id, (e ->> 'date')::date, coalesce((e ->> 'closed')::boolean, true), nullif(btrim(e ->> 'note'), '')
  from jsonb_array_elements(coalesce(p_exceptions, '[]')) e;
  insert into public.social_links (restaurant_id, instagram, facebook, tiktok, maps_url, google_review_url)
  values (p_restaurant_id, nullif(btrim(p_links ->> 'instagram'), ''), nullif(btrim(p_links ->> 'facebook'), ''),
    nullif(btrim(p_links ->> 'tiktok'), ''), nullif(btrim(p_links ->> 'maps_url'), ''), nullif(btrim(p_links ->> 'google_review_url'), ''))
  on conflict (restaurant_id) do update set
    instagram = excluded.instagram, facebook = excluded.facebook, tiktok = excluded.tiktok,
    maps_url = excluded.maps_url, google_review_url = excluded.google_review_url, updated_at = now();
end $$;

revoke execute on function public.invite_staff(uuid, text), public.remove_member(uuid), public.team_members(uuid),
  public.save_hours_and_links(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.invite_staff(uuid, text), public.remove_member(uuid), public.team_members(uuid),
  public.save_hours_and_links(uuid, jsonb, jsonb, jsonb) to authenticated;
