-- Testy RLS – Etap 2 (clients).
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

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
  ('44444444-4444-4444-4444-444444444444', 'wlascicielka.b@test.pl', now(), 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'obcy@test.pl', now(), 'authenticated', 'authenticated');

-- Dezaktywowana uczennica salonu A.
update public.users set deleted_at = now() where id = '33333333-3333-3333-3333-333333333333';

-- Klientki z datą zmiany w przeszłości (do testu updated_at i sortowania).
insert into public.clients (id, salon_id, full_name, phone, allergy_status, allergies, created_by, updated_at) values
  ('c1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Anna Testowa', '+48 600 111 222', 'has', 'PPD', '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('c1000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'Beata Próbna', '600 333 444', 'none', '', '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('c1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Cecylia Obca', '700 555 666', 'none', '', '44444444-4444-4444-4444-444444444444', now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- Schemat
-- ---------------------------------------------------------------------------

select is((select phone_digits from public.clients where id = 'c1000000-0000-0000-0000-0000000000a1'), '48600111222', 'phone_digits: same cyfry numeru');
select throws_ok(
  $$insert into public.clients (salon_id, full_name, phone, allergy_status, created_by) values ('a0000000-0000-0000-0000-00000000000a', '   ', '600111222', 'none', '11111111-1111-1111-1111-111111111111')$$,
  '23514', null, 'puste imię i nazwisko odrzucone');
select throws_ok(
  $$insert into public.clients (salon_id, full_name, phone, allergy_status, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'Ktoś', '12-34', 'none', '11111111-1111-1111-1111-111111111111')$$,
  '23514', null, 'za krótki telefon odrzucony');
select throws_ok(
  $$insert into public.clients (salon_id, full_name, phone, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'Ktoś', '600111222', '11111111-1111-1111-1111-111111111111')$$,
  '23502', null, 'wybór alergii obowiązkowy');

-- ---------------------------------------------------------------------------
-- Uczennica salonu A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.clients), 2, 'uczennica widzi tylko klientki swojego salonu');
select ok(not exists (select 1 from public.clients where salon_id = 'b0000000-0000-0000-0000-00000000000b'), 'brak klientek salonu B');

select lives_ok(
  $$insert into public.clients (full_name, phone, allergy_status) values ('Dorota Nowa', '601 222 333', 'none')$$,
  'uczennica dodaje klientkę');
select is((select salon_id from public.clients where full_name = 'Dorota Nowa'), 'a0000000-0000-0000-0000-00000000000a'::uuid, 'klientka trafia do salonu uczennicy');
select is((select created_by from public.clients where full_name = 'Dorota Nowa'), '22222222-2222-2222-2222-222222222222'::uuid, 'created_by = autorka');

select throws_ok(
  $$insert into public.clients (salon_id, full_name, phone, allergy_status) values ('b0000000-0000-0000-0000-00000000000b', 'Wtyczka', '602 000 000', 'none')$$,
  '42501', null, 'nie można dodać klientki do cudzego salonu');
select throws_ok(
  $$insert into public.clients (full_name, phone, allergy_status, created_by) values ('Podszyta', '602 000 001', 'none', '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'nie można podać cudzego created_by');
select throws_ok(
  $$insert into public.clients (full_name, phone, allergy_status, deleted_at) values ('Usunięta', '602 000 002', 'none', now())$$,
  '42501', null, 'nie można dodać od razu usuniętej klientki');

select lives_ok(
  $$update public.clients set phone = '600 999 888', allergy_status = 'has', allergies = 'Lateks' where id = 'c1000000-0000-0000-0000-0000000000a2'$$,
  'uczennica edytuje klientkę');
select ok(
  (select updated_at > now() - interval '1 hour' from public.clients where id = 'c1000000-0000-0000-0000-0000000000a2'),
  'edycja odświeża updated_at');

select throws_ok(
  $$update public.clients set deleted_at = now() where id = 'c1000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'uczennica nie usuwa klientek');
select throws_ok(
  $$update public.clients set salon_id = 'b0000000-0000-0000-0000-00000000000b' where id = 'c1000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'nie można zmienić salon_id');
select throws_ok(
  $$update public.clients set created_by = '22222222-2222-2222-2222-222222222222' where id = 'c1000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'nie można zmienić created_by');

update public.clients set full_name = 'Przejęta' where id = 'c1000000-0000-0000-0000-0000000000b1';
reset role;
select is((select full_name from public.clients where id = 'c1000000-0000-0000-0000-0000000000b1'), 'Cecylia Obca', 'uczennica nie edytuje klientek salonu B');
set local role authenticated;

select throws_ok(
  $$delete from public.clients where id = 'c1000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'DELETE na clients zabroniony');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu A
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.clients set deleted_at = now() where full_name = 'Dorota Nowa'$$,
  'właścicielka usuwa klientkę (miękko)');
select ok(
  (select deleted_at is not null from public.clients where full_name = 'Dorota Nowa'),
  'usunięta klientka ma deleted_at, wiersz zostaje');
select is((select count(*)::int from public.clients where deleted_at is null), 2, 'lista aktywnych bez usuniętej');
select ok(not exists (select 1 from public.clients where salon_id = 'b0000000-0000-0000-0000-00000000000b'), 'właścicielka nie widzi klientek salonu B');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu B
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select results_eq('select full_name from public.clients', array['Cecylia Obca'], 'salon B widzi tylko swoją klientkę');
update public.clients set deleted_at = now() where id = 'c1000000-0000-0000-0000-0000000000a1';
reset role;
select ok((select deleted_at is null from public.clients where id = 'c1000000-0000-0000-0000-0000000000a1'), 'właścicielka B nie usuwa klientek salonu A');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Dezaktywowana uczennica i konto bez zaproszenia
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is((select count(*)::int from public.clients), 0, 'dezaktywowana: brak klientek');
select throws_ok(
  $$insert into public.clients (full_name, phone, allergy_status) values ('Po odejściu', '603 000 000', 'none')$$,
  null, null, 'dezaktywowana: nie dodaje klientek');

set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select is((select count(*)::int from public.clients), 0, 'bez zaproszenia: brak klientek');

-- ---------------------------------------------------------------------------
-- Anonim
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok('select * from public.clients', '42501', null, 'anon: brak dostępu do clients');

select * from finish();
rollback;
