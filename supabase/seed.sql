-- Demo data. Runs after migrations (`supabase db reset`).
-- Fixed ids so links and tests can refer to them.

-- ---------------------------------------------------------------------------
-- Pizzeria Roma (Jijel), template: pizzeria. Used by /demo.
-- ---------------------------------------------------------------------------
insert into public.restaurants (
  id, slug, name, type, wilaya_code, commune, address, template_key, default_locale,
  whatsapp_order_phone, status, trial_ends_at, paid_until, plan,
  orders_enabled, delivery_enabled, takeaway_enabled, min_order, eta_label, onboarding_step, went_live_at
) values (
  '00000000-0000-4000-a000-000000000001', 'pizzeria-roma', 'Pizzeria Roma', 'pizzeria', 18, 'Jijel',
  'Rue Abane Ramdane, Jijel', 'pizzeria', 'fr',
  '+213555000001', 'active', now() - interval '30 days', '2099-12-31', 'annual',
  true, true, true, 500, '30-45 min', 8, now()
);

insert into public.social_links (restaurant_id, instagram, facebook, tiktok, maps_url) values (
  '00000000-0000-4000-a000-000000000001', 'pizzeriaroma.jijel', 'pizzeriaroma.jijel', null,
  'https://maps.google.com/?q=Jijel'
);

insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '00000000-0000-4000-a000-000000000001'::uuid, d, '11:00'::time, '23:30'::time from generate_series(0, 6) d where d <> 5
union all
select '00000000-0000-4000-a000-000000000001'::uuid, 5, '14:00'::time, '23:30'::time;

insert into public.categories (id, restaurant_id, name, icon, position) values
  ('00000000-0000-4000-b001-000000000001', '00000000-0000-4000-a000-000000000001', '{"fr":"Pizzas","ar":"بيتزا"}', 'pizza', 1),
  ('00000000-0000-4000-b001-000000000002', '00000000-0000-4000-a000-000000000001', '{"fr":"Sandwichs","ar":"سندويتشات"}', 'sandwich', 2),
  ('00000000-0000-4000-b001-000000000003', '00000000-0000-4000-a000-000000000001', '{"fr":"Boissons","ar":"مشروبات"}', 'cup-soda', 3),
  ('00000000-0000-4000-b001-000000000004', '00000000-0000-4000-a000-000000000001', '{"fr":"Desserts","ar":"حلويات"}', 'cake', 4);

insert into public.items (id, restaurant_id, category_id, name, description, base_price, tags, position) values
  ('00000000-0000-4000-c001-000000000001', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000001',
   '{"fr":"Pizza Margherita","ar":"بيتزا مارغريتا"}',
   '{"fr":"Sauce tomate, mozzarella, basilic.","ar":"صلصة طماطم، موزاريلا، ريحان."}', 800, '{best_seller,vegetarian}', 1),
  ('00000000-0000-4000-c001-000000000002', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000001',
   '{"fr":"Pizza 4 Saisons","ar":"بيتزا الفصول الأربعة"}',
   '{"fr":"Tomate, mozzarella, champignons, artichauts, olives, jambon de dinde.","ar":"طماطم، موزاريلا، فطر، خرشوف، زيتون، لحم ديك رومي."}', 1100, '{}', 2),
  ('00000000-0000-4000-c001-000000000003', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000002',
   '{"fr":"Chawarma poulet","ar":"شاورما دجاج"}',
   '{"fr":"Poulet mariné, sauce blanche, frites.","ar":"دجاج متبّل، صلصة بيضاء، بطاطا مقلية."}', 450, '{dish_of_day}', 1),
  ('00000000-0000-4000-c001-000000000004', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000002',
   '{"fr":"Tacos","ar":"تاكوس"}',
   '{"fr":"Viande hachée, fromage fondu, frites.","ar":"لحم مفروم، جبن ذائب، بطاطا مقلية."}', 550, '{spicy}', 2),
  ('00000000-0000-4000-c001-000000000005', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000003',
   '{"fr":"Café crème","ar":"قهوة بالحليب"}', '{}', 150, '{}', 1),
  ('00000000-0000-4000-c001-000000000006', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000003',
   '{"fr":"Thé à la menthe","ar":"شاي بالنعناع"}', '{}', 100, '{}', 2),
  ('00000000-0000-4000-c001-000000000007', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000003',
   '{"fr":"Jus d''orange pressé","ar":"عصير برتقال طبيعي"}', '{}', 250, '{new}', 3),
  ('00000000-0000-4000-c001-000000000008', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b001-000000000004',
   '{"fr":"Kalb el louz","ar":"قلب اللوز"}',
   '{"fr":"Gâteau de semoule aux amandes, sirop de fleur d''oranger.","ar":"حلوى السميد باللوز وشراب ماء الزهر."}', 120, '{}', 1);

insert into public.item_variants (item_id, restaurant_id, name, price, position) values
  ('00000000-0000-4000-c001-000000000002', '00000000-0000-4000-a000-000000000001', '{"fr":"Moyenne","ar":"متوسطة"}', 1100, 1),
  ('00000000-0000-4000-c001-000000000002', '00000000-0000-4000-a000-000000000001', '{"fr":"Large","ar":"كبيرة"}', 1500, 2);

insert into public.item_extras (item_id, restaurant_id, name, price, position) values
  ('00000000-0000-4000-c001-000000000001', '00000000-0000-4000-a000-000000000001', '{"fr":"Supplément fromage","ar":"جبن إضافي"}', 100, 1),
  ('00000000-0000-4000-c001-000000000002', '00000000-0000-4000-a000-000000000001', '{"fr":"Supplément fromage","ar":"جبن إضافي"}', 100, 1),
  ('00000000-0000-4000-c001-000000000004', '00000000-0000-4000-a000-000000000001', '{"fr":"Sauce algérienne","ar":"صلصة جزائرية"}', 0, 1);

insert into public.tables (restaurant_id, code, label, zone, position)
select '00000000-0000-4000-a000-000000000001'::uuid, 'T' || n, 'Table ' || n, case when n <= 4 then 'Salle' else 'Terrasse' end, n
from generate_series(1, 8) n;

insert into public.delivery_zones (restaurant_id, name, fee, position) values
  ('00000000-0000-4000-a000-000000000001', 'Jijel centre', 150, 1),
  ('00000000-0000-4000-a000-000000000001', 'Kissir', 250, 2),
  ('00000000-0000-4000-a000-000000000001', 'Taher', 300, 3);

-- ---------------------------------------------------------------------------
-- Café El Bahia (Béjaïa), template: cafe.
-- ---------------------------------------------------------------------------
insert into public.restaurants (
  id, slug, name, type, wilaya_code, commune, address, template_key, default_locale,
  status, trial_ends_at, orders_enabled, onboarding_step, went_live_at
) values (
  '00000000-0000-4000-a000-000000000002', 'cafe-el-bahia', 'Café El Bahia', 'cafe', 6, 'Béjaïa',
  'Boulevard de la Liberté, Béjaïa', 'cafe', 'fr',
  'trial', now() + interval '10 days', false, 8, now()
);

insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '00000000-0000-4000-a000-000000000002'::uuid, d, '06:30'::time, '20:00'::time from generate_series(0, 6) d;

insert into public.categories (id, restaurant_id, name, icon, position) values
  ('00000000-0000-4000-b002-000000000001', '00000000-0000-4000-a000-000000000002', '{"fr":"Cafés","ar":"قهوة"}', 'coffee', 1),
  ('00000000-0000-4000-b002-000000000002', '00000000-0000-4000-a000-000000000002', '{"fr":"Thés & infusions","ar":"شاي ومنقوعات"}', 'leaf', 2),
  ('00000000-0000-4000-b002-000000000003', '00000000-0000-4000-a000-000000000002', '{"fr":"Viennoiseries & gâteaux","ar":"معجنات وحلويات"}', 'croissant', 3);

insert into public.items (restaurant_id, category_id, name, base_price, tags, position) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000001', '{"fr":"Café noir","ar":"قهوة سوداء"}', 80, '{}', 1),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000001', '{"fr":"Café crème","ar":"قهوة بالحليب"}', 120, '{best_seller}', 2),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000001', '{"fr":"Cappuccino","ar":"كابتشينو"}', 200, '{}', 3),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000002', '{"fr":"Thé à la menthe","ar":"شاي بالنعناع"}', 100, '{}', 1),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000002', '{"fr":"Thé aux pignons","ar":"شاي بالصنوبر"}', 250, '{new}', 2),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000003', '{"fr":"Croissant","ar":"كرواسون"}', 60, '{}', 1),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000003', '{"fr":"Kalb el louz","ar":"قلب اللوز"}', 120, '{dish_of_day}', 2),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b002-000000000003', '{"fr":"Makrout","ar":"مقروط"}', 80, '{}', 3);

insert into public.tables (restaurant_id, code, label, position)
select '00000000-0000-4000-a000-000000000002'::uuid, 'B' || n, 'Table ' || n, n from generate_series(1, 6) n;

-- Example payment details for the billing screen (replace in admin settings).
update public.platform_settings set
  baridimob_rip = '00799999000000000000',
  ccp_number = '0000000000',
  ccp_key = '00',
  ccp_holder = 'LIINKY SARL';
