-- Storage buckets. Object paths always start with the restaurant id:
--   menu-images/{restaurant_id}/{logo|cover|items}/...   public read
--   receipts/{restaurant_id}/{payment_id}.jpg            private, signed URLs
--   imports/{restaurant_id}/{import_id}/...              private (AI import sources)
--   kit/{restaurant_id}/{kit_order_id}/mockup.pdf        private (owner + admin)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('imports', 'imports', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('kit', 'kit', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create or replace function public.storage_restaurant_id(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.storage_restaurant_id(text) to authenticated;

-- menu-images: anyone reads (public bucket); members write while the menu is editable.
create policy "menu images: members write" on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images' and public.can_edit_menu(public.storage_restaurant_id(name)));
create policy "menu images: members update" on storage.objects for update to authenticated
  using (bucket_id = 'menu-images' and public.can_edit_menu(public.storage_restaurant_id(name)));
create policy "menu images: members delete" on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images' and public.can_edit_menu(public.storage_restaurant_id(name)));

-- receipts: owners upload and read their own; admins read all. Staff never.
create policy "receipts: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.member_role(public.storage_restaurant_id(name)) = 'owner');
create policy "receipts: owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_owner(public.storage_restaurant_id(name)));

-- imports: members upload and read (menu editing permission).
create policy "imports: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and public.can_edit_menu(public.storage_restaurant_id(name)));
create policy "imports: members read" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and public.is_member(public.storage_restaurant_id(name)));

-- kit: owners read mockups; admins write (is_owner() is true for super admins).
create policy "kit: owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'kit' and public.is_owner(public.storage_restaurant_id(name)));
create policy "kit: admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'kit' and public.is_super_admin());
