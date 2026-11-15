-- Testy RLS – Etap 4 (services, visits, recipes, recipe_mixes, mix_items, save_recipe, import_services, product_usage).
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(53);

-- ---------------------------------------------------------------------------
-- Dane testowe (jako postgres, z pominięciem RLS)
-- ---------------------------------------------------------------------------

insert into public.salons (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B');

insert into public.invitations (salon_id, email, role, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'wlascicielka.a@test.pl', 'owner', 'Właścicielka A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica.a@test.pl', 'apprentice', 'Uczennica A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica2.a@test.pl', 'apprentice', 'Uczennica A2'),
  ('b0000000-0000-0000-0000-00000000000b', 'wlascicielka.b@test.pl', 'owner', 'Właścicielka B');

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'wlascicielka.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'uczennica2.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'wlascicielka.b@test.pl', now(), 'authenticated', 'authenticated');

insert into public.clients (id, salon_id, full_name, phone, allergy_status, created_by) values
  ('c1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Anna Testowa', '600111222', 'none', '11111111-1111-1111-1111-111111111111'),
  ('c1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Cecylia Obca', '700555666', 'none', '44444444-4444-4444-4444-444444444444');

insert into public.product_lines (id, salon_id, brand, name, default_ratio, created_by) values
  ('d1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Marka A', 'Classic', 1.5, '11111111-1111-1111-1111-111111111111'),
  ('d1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Marka B', 'B', null, '44444444-4444-4444-4444-444444444444');

insert into public.products (id, salon_id, line_id, shade, type, created_by) values
  ('e1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '7.1', 'farba', '11111111-1111-1111-1111-111111111111'),
  ('e1000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '8.0', 'farba', '11111111-1111-1111-1111-111111111111'),
  ('e1000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '6%', 'utleniacz', '11111111-1111-1111-1111-111111111111'),
  ('e1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'd1000000-0000-0000-0000-0000000000b1', '6.0', 'farba', '44444444-4444-4444-4444-444444444444');

insert into public.services (id, salon_id, name, price_from, price_to, duration_min, with_color, created_by) values
  ('f1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Koloryzacja', 150, 250, 120, true, '11111111-1111-1111-1111-111111111111'),
  ('f1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Strzyżenie B', 80, null, 45, false, '44444444-4444-4444-4444-444444444444');

-- ---------------------------------------------------------------------------
-- Schemat
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.services (salon_id, name, price_from, price_to, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'Zła', 200, 100, '11111111-1111-1111-1111-111111111111')$$,
  '23514', null, 'cena do nie może być niższa niż cena od');
select throws_ok(
  $$insert into public.services (salon_id, name, created_by) values ('a0000000-0000-0000-0000-00000000000a', ' KOLORYZACJA ', '11111111-1111-1111-1111-111111111111')$$,
  '23505', null, 'ta sama usługa (inna wielkość liter) odrzucona');
select throws_ok(
  $$insert into public.visits (salon_id, client_id, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111')$$,
  '23503', null, 'wizyta nie trafi do klientki innego salonu');
select throws_ok(
  $$insert into public.visits (salon_id, client_id, service_id, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111')$$,
  '23503', null, 'wizyta nie użyje usługi innego salonu');

-- ---------------------------------------------------------------------------
-- Uczennica salonu A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.services), 1, 'uczennica widzi usługi tylko swojego salonu');
select throws_ok(
  $$insert into public.services (name) values ('Nowa usługa')$$,
  '42501', null, 'uczennica nie dodaje usług');
select throws_ok(
  $$select public.import_services('[{"name":"X"}]'::jsonb)$$,
  '42501', null, 'uczennica nie importuje usług');

select lives_ok(
  $$insert into public.visits (client_id, service_id, visit_at) values ('c1000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-0000000000a1', now() - interval '30 days')$$,
  'uczennica dodaje wizytę (data wstecz)');
-- Stały identyfikator do dalszych testów (id nadaje baza; kolumna bez grantu).
reset role;
update public.visits set id = 'aa000000-0000-0000-0000-0000000000a1' where client_id = 'c1000000-0000-0000-0000-0000000000a1';
set local role authenticated;
select is(
  (select created_by from public.visits where id = 'aa000000-0000-0000-0000-0000000000a1'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'wizyta: osoba wykonująca = autorka');
select is(
  (select salon_id from public.visits where id = 'aa000000-0000-0000-0000-0000000000a1'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'wizyta trafia do salonu autorki');
select throws_ok(
  $$insert into public.visits (client_id) values ('c1000000-0000-0000-0000-0000000000b1')$$,
  '23503', null, 'uczennica nie doda wizyty klientce innego salonu');
select throws_ok(
  $$insert into public.visits (client_id, created_by) values ('c1000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'nie można podać cudzego created_by');

-- Receptura: 2 mieszanki, druga bez utleniacza.
select ok(
  public.save_recipe('aa000000-0000-0000-0000-0000000000a1', $${
    "note": "Test",
    "mixes": [
      {"zone":"odrost","oxidant_percent":6,"ratio":1.5,"oxidant_product_id":"e1000000-0000-0000-0000-0000000000a3","processing_minutes":35,
       "items":[{"product_id":"e1000000-0000-0000-0000-0000000000a1","grams":30},{"product_id":"e1000000-0000-0000-0000-0000000000a2","grams":15}]},
      {"zone":"dlugosci","oxidant_percent":null,"ratio":2,"oxidant_product_id":"e1000000-0000-0000-0000-0000000000a3",
       "items":[{"product_id":"e1000000-0000-0000-0000-0000000000a2","grams":20}]}
    ]}$$::jsonb) is not null,
  'uczennica zapisuje recepturę swojej wizyty');
select is((select count(*)::int from public.recipe_mixes where deleted_at is null), 2, 'receptura: 2 mieszanki');
select is(
  (select oxidant_grams from public.recipe_mixes where zone = 'odrost' and deleted_at is null), 67.5,
  'gramy utleniacza liczy baza: (30 + 15) × 1,5');
select ok(
  (select oxidant_grams = 0 and ratio is null and oxidant_product_id is null from public.recipe_mixes where zone = 'dlugosci' and deleted_at is null),
  'mieszanka bez utleniacza: 0 g, bez proporcji i produktu');
select is((select count(*)::int from public.mix_items where deleted_at is null), 3, 'receptura: 3 pozycje farb');

-- Ponowny zapis: poprzednie mieszanki miękko usunięte.
select lives_ok(
  $$select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"note":"Poprawka","mixes":[{"zone":"calosc","oxidant_percent":9,"ratio":1,"items":[{"product_id":"e1000000-0000-0000-0000-0000000000a1","grams":60}]}]}'::jsonb)$$,
  'edycja receptury');
select is((select count(*)::int from public.recipe_mixes where deleted_at is null), 1, 'po edycji: 1 aktywna mieszanka');
select is((select count(*)::int from public.recipe_mixes), 3, 'stare mieszanki zostają w bazie (miękko usunięte)');
select is((select count(*)::int from public.recipes where deleted_at is null), 1, 'nadal jedna receptura na wizytę');
select is((select note from public.recipes where deleted_at is null), 'Poprawka', 'notatka receptury zaktualizowana');

select throws_ok(
  $$select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"mixes":[{"zone":"calosc","oxidant_percent":null,"items":[{"product_id":"e1000000-0000-0000-0000-0000000000b1","grams":10}]}]}'::jsonb)$$,
  '23503', null, 'receptura nie użyje produktu innego salonu');
select is((select count(*)::int from public.recipe_mixes where deleted_at is null), 1, 'po błędzie receptura bez zmian (rollback)');

select lives_ok(
  $$update public.visits set visit_at = now() - interval '400 days', price = 180 where id = 'aa000000-0000-0000-0000-0000000000a1'$$,
  'autorka edytuje datę i cenę wizyty');
select throws_ok(
  $$update public.visits set deleted_at = now() where id = 'aa000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'uczennica nie usuwa wizyt');
select throws_ok(
  $$update public.visits set client_id = 'c1000000-0000-0000-0000-0000000000a1' where id = 'aa000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'nie można przenieść wizyty do innej klientki');
select throws_ok(
  $$delete from public.visits$$, '42501', null, 'DELETE na visits zabroniony');
select throws_ok(
  $$delete from public.mix_items$$, '42501', null, 'DELETE na mix_items zabroniony');

select is(
  (select uses from public.product_usage() where product_id = 'e1000000-0000-0000-0000-0000000000a1'), 1::bigint,
  'product_usage liczy tylko aktywne pozycje');

-- ---------------------------------------------------------------------------
-- Druga uczennica salonu A – czyta, ale nie edytuje cudzej wizyty
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is((select count(*)::int from public.visits), 1, 'druga uczennica widzi wizyty salonu');
select is((select count(*)::int from public.mix_items where deleted_at is null), 1, 'druga uczennica widzi recepturę');
select throws_ok(
  $$select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"mixes":[]}'::jsonb)$$,
  '42501', null, 'druga uczennica nie edytuje cudzej receptury');
update public.visits set price = 1 where id = 'aa000000-0000-0000-0000-0000000000a1';
update public.recipes set note = 'Przejęta' where visit_id = 'aa000000-0000-0000-0000-0000000000a1';
update public.mix_items set deleted_at = now();
reset role;
select is((select price from public.visits where id = 'aa000000-0000-0000-0000-0000000000a1'), 180.00, 'druga uczennica nie zmienia cudzej wizyty');
select is((select note from public.recipes where deleted_at is null), 'Poprawka', 'druga uczennica nie zmienia cudzej receptury');
select is((select count(*)::int from public.mix_items where deleted_at is null), 1, 'druga uczennica nie usuwa cudzych pozycji');
set local role authenticated;
select throws_ok(
  $$insert into public.recipe_mixes (recipe_id, zone) values ((select id from public.recipes where deleted_at is null), 'konce')$$,
  '42501', null, 'druga uczennica nie dopisuje mieszanki do cudzej receptury');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu A
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"note":"Właścicielka","mixes":[{"zone":"calosc","oxidant_percent":6,"ratio":2,"items":[{"product_id":"e1000000-0000-0000-0000-0000000000a2","grams":40}]}]}'::jsonb)$$,
  'właścicielka edytuje recepturę uczennicy');
select is((select oxidant_grams from public.recipe_mixes where deleted_at is null), 80.0, 'gramy utleniacza: 40 × 2');

-- Import usług: nowa + aktualizacja wypełnionych pól.
select is(
  public.import_services($$[
    {"name":"Strzyżenie","price_from":80,"price_to":120,"duration_min":45,"with_color":false},
    {"name":"koloryzacja","price_to":300}
  ]$$::jsonb),
  '{"created":1,"updated":1}'::jsonb,
  'import usług: nowa usługa i aktualizacja istniejącej');
select ok(
  (select price_from = 150 and price_to = 300 and with_color from public.services where name = 'Koloryzacja'),
  'import usług: puste pola nie nadpisują');
select is(
  public.import_services('[{"name":"Strzyżenie","price_from":80,"price_to":120,"duration_min":45,"with_color":false}]'::jsonb),
  '{"created":0,"updated":0}'::jsonb,
  'import usług idempotentny');
select throws_ok(
  $$select public.import_services('[{"name":"Dobra"},{"name":"Zła","price_from":"abc"}]'::jsonb)$$,
  '22P02', null, 'import usług: błędny wiersz odrzuca całość');
select ok(not exists (select 1 from public.services where name = 'Dobra'), 'import usług: po błędzie nic nie zapisane');

select lives_ok(
  $$update public.visits set deleted_at = now() where id = 'aa000000-0000-0000-0000-0000000000a1'$$,
  'właścicielka usuwa wizytę (miękko)');
select is((select count(*)::int from public.visits where deleted_at is null), 0, 'usunięta wizyta znika z aktywnych');
select throws_ok(
  $$select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"mixes":[]}'::jsonb)$$,
  '42501', null, 'usuniętej wizyty nie można edytować');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu B i anonim
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is((select count(*)::int from public.visits), 0, 'salon B nie widzi wizyt salonu A');
select is((select count(*)::int from public.recipe_mixes), 0, 'salon B nie widzi receptur salonu A');
select results_eq('select name from public.services', array['Strzyżenie B'], 'salon B widzi tylko swoje usługi');
select is((select count(*)::int from public.product_usage()), 0, 'product_usage tylko dla własnego salonu');

reset role;
set local role anon;
select throws_ok('select * from public.visits', '42501', null, 'anon: brak dostępu do visits');
select throws_ok('select * from public.mix_items', '42501', null, 'anon: brak dostępu do mix_items');

select * from finish();
rollback;
