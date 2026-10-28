-- Phase 3: public menus.
insert into public.reserved_slugs (slug) values ('apercu') on conflict do nothing;
