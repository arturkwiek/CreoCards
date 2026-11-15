-- Testy – Etap 4a (audit_log, migawki receptur, restore_version, log_export, kosz).
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

-- ---------------------------------------------------------------------------
-- Dane testowe
-- ---------------------------------------------------------------------------

insert into public.salons (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B');

insert into public.invitations (salon_id, email, role, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'wlascicielka.a@test.pl', 'owner', 'Właścicielka A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica.a@test.pl', 'apprentice', 'Uczennica A'),
  ('b0000000-0000-0000-0000-00000000000b', 'wlascicielka.b@test.pl', 'owner', 'Właścicielka B');

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'wlascicielka.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'wlascicielka.b@test.pl', now(), 'authenticated', 'authenticated');

insert into public.clients (id, salon_id, full_name, phone, allergy_status, allergies, created_by) values
  ('c1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Anna Testowa', '600111222', 'has', 'PPD', '22222222-2222-2222-2222-222222222222');

insert into public.product_lines (id, salon_id, brand, name, created_by) values
  ('d1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Marka A', 'Classic', '11111111-1111-1111-1111-111111111111');
insert into public.products (id, salon_id, line_id, shade, type, created_by) values
  ('e1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '7.1', 'farba', '11111111-1111-1111-1111-111111111111'),
  ('e1000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '8.0', 'farba', '11111111-1111-1111-1111-111111111111');

-- Klientka w koszu (do testu przywracania przez uczennicę).
insert into public.clients (id, salon_id, full_name, phone, allergy_status, created_by, deleted_at) values
  ('c1000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'Beata Usunięta', '600333444', 'none', '11111111-1111-1111-1111-111111111111', now());

insert into public.visits (id, salon_id, client_id, created_by) values
  ('aa000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222');

-- ---------------------------------------------------------------------------
-- Uczennica: zmiany trafiają do historii, ale historii nie widzi
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

update public.clients set allergies = 'PPD, lateks', phone = '600999888' where id = 'c1000000-0000-0000-0000-0000000000a1';
select lives_ok(
  $$select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"note":"Pierwsza","mixes":[{"zone":"odrost","oxidant_percent":6,"ratio":1.5,"items":[{"product_id":"e1000000-0000-0000-0000-0000000000a1","grams":30}]}]}'::jsonb)$$,
  'uczennica zapisuje pierwszą recepturę');
select lives_ok(
  $$select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"note":"Druga","mixes":[{"zone":"calosc","oxidant_percent":9,"ratio":2,"items":[{"product_id":"e1000000-0000-0000-0000-0000000000a2","grams":60}]}]}'::jsonb)$$,
  'uczennica zmienia recepturę');

select is((select count(*)::int from public.audit_log), 0, 'uczennica nie widzi historii');
select throws_ok(
  $$insert into public.audit_log (salon_id, table_name, action) values ('a0000000-0000-0000-0000-00000000000a', 'clients', 'update')$$,
  '42501', null, 'nie można dopisać wpisu do historii');
select throws_ok($$select public.restore_version(1)$$, '42501', null, 'uczennica nie przywraca wersji');
select throws_ok($$select public.log_export('all')$$, '42501', null, 'uczennica nie eksportuje danych');
select throws_ok(
  $$update public.clients set deleted_at = null where id = 'c1000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'uczennica nie przywraca z kosza (trigger)');

-- ---------------------------------------------------------------------------
-- Schemat i trigger (jako postgres)
-- ---------------------------------------------------------------------------

reset role;

select ok(
  (select old_row ->> 'allergies' = 'PPD' and old_row ->> 'phone' = '600111222' and action = 'update'
          and created_by = '22222222-2222-2222-2222-222222222222'
   from public.audit_log where table_name = 'clients' order by id desc limit 1),
  'clients: poprzednia wersja, kto, rodzaj zmiany');
select ok(
  (select created_at > now() - interval '1 hour' from public.audit_log where table_name = 'clients' limit 1),
  'clients: kiedy');
select is(
  (select count(*)::int from public.audit_log where table_name = 'visit_recipe' and action = 'recipe_snapshot'), 1,
  'migawka receptury przed zmianą (pierwszy zapis bez migawki)');
select is(
  (select old_row #>> '{mixes,0,items,0,grams}' from public.audit_log where table_name = 'visit_recipe'), '30.0',
  'migawka zawiera mieszanki i farby');
select is(
  (select old_row ->> 'note' from public.audit_log where table_name = 'visit_recipe'), 'Pierwsza',
  'migawka zawiera notatkę');
select ok(
  exists (select 1 from public.audit_log where table_name = 'recipe_mixes' and action = 'delete')
  and exists (select 1 from public.audit_log where table_name = 'mix_items' and action = 'delete')
  and exists (select 1 from public.audit_log where table_name = 'recipes' and action = 'update'),
  'recipes, recipe_mixes, mix_items: zmiany w historii');

update public.visits set price = 150 where id = 'aa000000-0000-0000-0000-0000000000a1';
update public.visits set price = 150 where id = 'aa000000-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from public.audit_log where table_name = 'visits'), 1,
  'visits: zapis bez zmian nie tworzy wersji');

update public.products set shade = '7/1' where id = 'e1000000-0000-0000-0000-0000000000a1';
select is(
  (select old_row ->> 'shade' from public.audit_log where table_name = 'products'), '7.1',
  'products: poprzednia wersja');

-- ---------------------------------------------------------------------------
-- Właścicielka: historia, przywracanie wersji, kosz, eksport
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok((select count(*) from public.audit_log) > 0, 'właścicielka widzi historię salonu');

select lives_ok(
  format('select public.restore_version(%s)', (select id from public.audit_log where table_name = 'clients' order by id limit 1)),
  'właścicielka przywraca wersję klientki');
select is(
  (select allergies || ' / ' || phone from public.clients where id = 'c1000000-0000-0000-0000-0000000000a1'),
  'PPD / 600111222', 'klientka: przywrócona poprzednia wersja');
select ok(
  (select old_row ->> 'allergies' = 'PPD, lateks' from public.audit_log where table_name = 'clients' order by id desc limit 1),
  'przywrócenie też trafia do historii (można je cofnąć)');

select lives_ok(
  format('select public.restore_version(%s)', (select id from public.audit_log where table_name = 'visit_recipe' limit 1)),
  'właścicielka przywraca poprzednią recepturę');
select ok(
  (select r.note = 'Pierwsza' and m.zone = 'odrost' and m.oxidant_grams = 45.0 and i.grams = 30.0
   from public.recipes r
   join public.recipe_mixes m on m.recipe_id = r.id and m.deleted_at is null
   join public.mix_items i on i.mix_id = m.id and i.deleted_at is null
   where r.visit_id = 'aa000000-0000-0000-0000-0000000000a1' and r.deleted_at is null),
  'receptura: przywrócona cała poprzednia wersja');
select is(
  (select count(*)::int from public.audit_log where table_name = 'visit_recipe'), 2,
  'przywrócenie receptury zapisuje migawkę bieżącej (można cofnąć)');

select lives_ok(
  format('select public.restore_version(%s)', (select id from public.audit_log where table_name = 'visits' limit 1)),
  'właścicielka przywraca wersję wizyty');
select is((select price from public.visits where id = 'aa000000-0000-0000-0000-0000000000a1'), null, 'wizyta: przywrócona cena sprzed zmiany');

-- Kosz: usunięcie i przywrócenie.
update public.clients set deleted_at = now() where id = 'c1000000-0000-0000-0000-0000000000a1';
select ok(
  exists (select 1 from public.audit_log where table_name = 'clients' and action = 'delete' and created_by = '11111111-1111-1111-1111-111111111111'),
  'usunięcie w historii (kto usunął)');
select throws_ok(
  format('select public.restore_version(%s)', (select id from public.audit_log where table_name = 'clients' order by id limit 1)),
  'P0002', null, 'wersji usuniętej klientki nie przywraca się przed kosza');
select lives_ok(
  $$update public.clients set deleted_at = null where id = 'c1000000-0000-0000-0000-0000000000a1'$$,
  'właścicielka przywraca klientkę z kosza');
select ok(
  exists (select 1 from public.audit_log where table_name = 'clients' and action = 'restore'),
  'przywrócenie z kosza w historii');

select lives_ok($$select public.log_export('client', 'c1000000-0000-0000-0000-0000000000a1')$$, 'właścicielka eksportuje dane klientki');
select ok(
  exists (select 1 from public.audit_log where action = 'export' and row_id = 'c1000000-0000-0000-0000-0000000000a1' and created_by = '11111111-1111-1111-1111-111111111111'),
  'eksport zapisany w historii (kto i co)');

select throws_ok(
  $$update public.audit_log set old_row = '{}'::jsonb$$, '42501', null, 'historii nie można zmienić');
select throws_ok(
  $$delete from public.audit_log$$, '42501', null, 'historii nie można usunąć');

-- ---------------------------------------------------------------------------
-- Inny salon
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select is((select count(*)::int from public.audit_log), 0, 'właścicielka B nie widzi historii salonu A');

select * from finish();
rollback;
