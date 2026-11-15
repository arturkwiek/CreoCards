-- Testy RLS – Etap 3 (product_lines, products, product_requests, import_products).
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

-- ---------------------------------------------------------------------------
-- Dane testowe (jako postgres, z pominięciem RLS)
-- ---------------------------------------------------------------------------

insert into public.salons (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B');

insert into public.invitations (salon_id, email, role, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'wlascicielka.a@test.pl', 'owner', 'Właścicielka A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica.a@test.pl', 'apprentice', 'Uczennica A'),
  ('a0000000-0000-0000-0000-00000000000a', 'byla.a@test.pl', 'apprentice', 'Była A'),
  ('b0000000-0000-0000-0000-00000000000b', 'wlascicielka.b@test.pl', 'owner', 'Właścicielka B');

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'wlascicielka.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'byla.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'wlascicielka.b@test.pl', now(), 'authenticated', 'authenticated');

update public.users set deleted_at = now() where id = '33333333-3333-3333-3333-333333333333';

insert into public.product_lines (id, salon_id, brand, name, default_ratio, created_by) values
  ('d1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Marka A', 'Linia Classic', 1.5, '11111111-1111-1111-1111-111111111111'),
  ('d1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Marka B', 'Linia B', null, '44444444-4444-4444-4444-444444444444');

insert into public.products (id, salon_id, line_id, shade, type, package_size, purchase_price, created_by) values
  ('e1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '7.1', 'farba', 60, 21.50, '11111111-1111-1111-1111-111111111111'),
  ('e1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'd1000000-0000-0000-0000-0000000000b1', '6.0', 'farba', 60, null, '44444444-4444-4444-4444-444444444444');

-- ---------------------------------------------------------------------------
-- Schemat
-- ---------------------------------------------------------------------------

select is(
  (select shade_key from public.products where id = 'e1000000-0000-0000-0000-0000000000a1'), '7.1',
  'shade_key: odcień w postaci porównawczej');
select throws_ok(
  $$insert into public.products (salon_id, line_id, shade, type, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '7/1', 'farba', '11111111-1111-1111-1111-111111111111')$$,
  '23505', null, '„7/1” to ten sam odcień co „7.1” – duplikat odrzucony');
select throws_ok(
  $$insert into public.product_lines (salon_id, brand, name, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'marka a', 'LINIA CLASSIC ', '11111111-1111-1111-1111-111111111111')$$,
  '23505', null, 'ta sama marka i linia (inna wielkość liter) odrzucona');
select throws_ok(
  $$insert into public.products (salon_id, line_id, shade, type, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000b1', '8.0', 'farba', '11111111-1111-1111-1111-111111111111')$$,
  '23503', null, 'produkt nie trafi do linii innego salonu');
select throws_ok(
  $$insert into public.product_lines (salon_id, brand, default_ratio, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'Zła', 0, '11111111-1111-1111-1111-111111111111')$$,
  '23514', null, 'proporcja musi być dodatnia');
select throws_ok(
  $$insert into public.product_requests (salon_id, kind, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'missing', '22222222-2222-2222-2222-222222222222')$$,
  '23514', null, '„brak w katalogu” wymaga opisu');
select throws_ok(
  $$insert into public.product_requests (salon_id, kind, description, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'running_low', 'coś', '22222222-2222-2222-2222-222222222222')$$,
  '23514', null, '„kończy się” wymaga produktu');

-- ---------------------------------------------------------------------------
-- Uczennica salonu A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.product_lines), 1, 'uczennica widzi linie tylko swojego salonu');
select is((select count(*)::int from public.products), 1, 'uczennica widzi produkty tylko swojego salonu');

select throws_ok(
  $$insert into public.product_lines (brand, name) values ('Nowa', 'Linia')$$,
  '42501', null, 'uczennica nie dodaje linii');
select throws_ok(
  $$insert into public.products (line_id, shade, type) values ('d1000000-0000-0000-0000-0000000000a1', '8.0', 'farba')$$,
  '42501', null, 'uczennica nie dodaje produktów');

update public.products set shade = '9.9' where id = 'e1000000-0000-0000-0000-0000000000a1';
update public.product_lines set default_ratio = 2 where id = 'd1000000-0000-0000-0000-0000000000a1';
reset role;
select is((select shade from public.products where id = 'e1000000-0000-0000-0000-0000000000a1'), '7.1', 'uczennica nie edytuje produktów');
select is((select default_ratio from public.product_lines where id = 'd1000000-0000-0000-0000-0000000000a1'), 1.50, 'uczennica nie edytuje linii');
set local role authenticated;

select throws_ok(
  $$select public.import_products('[{"brand":"X","shade":"1.0","type":"farba"}]'::jsonb)$$,
  '42501', null, 'uczennica nie importuje katalogu');

select lives_ok(
  $$insert into public.product_requests (kind, product_id) values ('running_low', 'e1000000-0000-0000-0000-0000000000a1')$$,
  'uczennica zgłasza: kończy się');
select lives_ok(
  $$insert into public.product_requests (kind, description) values ('missing', 'Marka A 5.5')$$,
  'uczennica zgłasza: brak w katalogu');
select is(
  (select created_by from public.product_requests where description = 'Marka A 5.5'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'zgłoszenie: created_by = autorka');
select is(
  (select salon_id from public.product_requests where description = 'Marka A 5.5'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'zgłoszenie trafia do salonu autorki');
select throws_ok(
  $$insert into public.product_requests (kind, product_id) values ('running_low', 'e1000000-0000-0000-0000-0000000000b1')$$,
  '23503', null, 'nie można zgłosić produktu innego salonu');
select throws_ok(
  $$insert into public.product_requests (kind, description, resolved_at) values ('missing', 'od razu załatwione', now())$$,
  '42501', null, 'nie można dodać zgłoszenia od razu załatwionego');

update public.product_requests set resolved_at = now() where description = 'Marka A 5.5';
reset role;
select ok(
  (select resolved_at is null from public.product_requests where description = 'Marka A 5.5'),
  'uczennica nie oznacza zgłoszeń jako załatwione');
set local role authenticated;

select throws_ok(
  $$delete from public.products where id = 'e1000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'DELETE na products zabroniony');
select throws_ok(
  $$delete from public.product_lines where id = 'd1000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'DELETE na product_lines zabroniony');
select throws_ok(
  $$delete from public.product_requests$$,
  '42501', null, 'DELETE na product_requests zabroniony');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu A
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.products (line_id, shade, type, package_size, ratio) values ('d1000000-0000-0000-0000-0000000000a1', '8.3', 'farba', 60, 2)$$,
  'właścicielka dodaje produkt');
select is(
  (select created_by from public.products where shade = '8.3'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'produkt: created_by = właścicielka');
select lives_ok(
  $$update public.products set purchase_price = 19.90 where shade = '8.3'$$,
  'właścicielka edytuje produkt');
select lives_ok(
  $$update public.product_lines set default_ratio = 2 where id = 'd1000000-0000-0000-0000-0000000000a1'$$,
  'właścicielka zmienia domyślną proporcję linii');
select throws_ok(
  $$update public.products set created_by = '22222222-2222-2222-2222-222222222222' where shade = '8.3'$$,
  '42501', null, 'nie można zmienić created_by produktu');
select throws_ok(
  $$update public.products set salon_id = 'b0000000-0000-0000-0000-00000000000b' where shade = '8.3'$$,
  '42501', null, 'nie można zmienić salon_id produktu');

select lives_ok(
  $$update public.products set deleted_at = now() where shade = '8.3'$$,
  'właścicielka usuwa produkt (miękko)');
select is(
  (select count(*)::int from public.products where deleted_at is null), 1,
  'usunięty produkt znika z aktywnych, wiersz zostaje');
select lives_ok(
  $$insert into public.products (line_id, shade, type) values ('d1000000-0000-0000-0000-0000000000a1', '8,3', 'farba')$$,
  'po usunięciu ten sam odcień można dodać ponownie');

select lives_ok(
  $$update public.product_requests set resolved_at = now(), resolved_by = '11111111-1111-1111-1111-111111111111' where description = 'Marka A 5.5'$$,
  'właścicielka oznacza zgłoszenie jako załatwione');
select throws_ok(
  $$update public.product_requests set resolved_by = '22222222-2222-2222-2222-222222222222' where description = 'Marka A 5.5'$$,
  '42501', null, 'resolved_by tylko jako ona sama');

-- Import: nowa linia + aktualizacja istniejącego produktu (puste pola nie nadpisują).
select is(
  public.import_products($$[
    {"brand":"Marka A","line":"Oxyd","shade":"6%","type":"utleniacz","package_size":1000},
    {"brand":"Marka A","line":"Oxyd","shade":"9%","type":"utleniacz","package_size":1000},
    {"brand":"marka a","line":"linia classic","shade":"7,1","type":"farba","line_ratio":1.5,"package_size":null,"ratio":null}
  ]$$::jsonb),
  '{"lines_created":1,"lines_updated":1,"products_created":2,"products_updated":0}'::jsonb,
  'import: nowa linia i produkty, linia zaktualizowana, istniejący odcień bez zmian');
select is(
  (select purchase_price from public.products where id = 'e1000000-0000-0000-0000-0000000000a1'), 21.50,
  'import: puste pole nie nadpisuje ceny');
select is(
  public.import_products($$[
    {"brand":"Marka A","line":"Linia Classic","shade":"7.1","type":"farba","purchase_price":23}
  ]$$::jsonb),
  '{"lines_created":0,"lines_updated":0,"products_created":0,"products_updated":1}'::jsonb,
  'import: ponowny import aktualizuje wypełnione pole');
select is(
  public.import_products($$[
    {"brand":"Marka A","line":"Linia Classic","shade":"7.1","type":"farba","purchase_price":23}
  ]$$::jsonb),
  '{"lines_created":0,"lines_updated":0,"products_created":0,"products_updated":0}'::jsonb,
  'import idempotentny: ten sam plik nic nie zmienia');
select throws_ok(
  $$select public.import_products('[{"brand":"Marka C","line":"L","shade":"1.0","type":"farba"},{"brand":"Marka C","line":"L","shade":"2.0","type":"zly-typ"}]'::jsonb)$$,
  '22P02', null, 'import: błędny wiersz odrzuca cały import');
select ok(
  not exists (select 1 from public.product_lines where brand = 'Marka C'),
  'import: po błędzie nic nie zostało zapisane');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu B
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select results_eq('select shade from public.products', array['6.0'], 'salon B widzi tylko swój katalog');
select is((select count(*)::int from public.product_requests), 0, 'salon B nie widzi zgłoszeń salonu A');
update public.products set purchase_price = 1 where id = 'e1000000-0000-0000-0000-0000000000a1';
reset role;
select is(
  (select purchase_price from public.products where id = 'e1000000-0000-0000-0000-0000000000a1'), 23.00,
  'właścicielka B nie edytuje katalogu salonu A');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Dezaktywowana uczennica i anonim
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is((select count(*)::int from public.products), 0, 'dezaktywowana: brak katalogu');

reset role;
set local role anon;
select throws_ok('select * from public.products', '42501', null, 'anon: brak dostępu do products');

select * from finish();
rollback;
