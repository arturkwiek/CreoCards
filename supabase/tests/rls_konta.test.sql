-- Testy RLS – Etap 1 (salons, users, invitations).
-- Uruchomienie: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

-- ---------------------------------------------------------------------------
-- Dane testowe (jako postgres, z pominięciem RLS)
-- ---------------------------------------------------------------------------

insert into public.salons (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B');

insert into public.invitations (salon_id, email, role, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'wlascicielka.a@test.pl', 'owner', 'Właścicielka A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica.a@test.pl', 'apprentice', 'Uczennica A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica2.a@test.pl', 'apprentice', 'Uczennica 2 A'),
  ('b0000000-0000-0000-0000-00000000000b', 'wlascicielka.b@test.pl', 'owner', 'Właścicielka B'),
  ('a0000000-0000-0000-0000-00000000000a', 'oczekuje.a@test.pl', 'apprentice', '');

-- Konta potwierdzone => trigger tworzy profile z zaproszeń.
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'wlascicielka.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'uczennica2.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'wlascicielka.b@test.pl', now(), 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'obcy@test.pl', now(), 'authenticated', 'authenticated');

-- Zaproszenie wysłane, ale jeszcze nieprzyjęte (e-mail niepotwierdzony).
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('66666666-6666-6666-6666-666666666666', 'oczekuje.a@test.pl', null, 'authenticated', 'authenticated');

-- ---------------------------------------------------------------------------
-- Trigger tworzenia profili
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.users), 4, 'profile powstały tylko dla potwierdzonych osób z zaproszeniem');
select is((select role from public.users where id = '11111111-1111-1111-1111-111111111111'), 'owner'::public.user_role, 'rola z zaproszenia');
select is((select full_name from public.users where id = '22222222-2222-2222-2222-222222222222'), 'Uczennica A', 'imię z zaproszenia');
select ok(not exists (select 1 from public.users where id = '55555555-5555-5555-5555-555555555555'), 'konto bez zaproszenia nie ma profilu');
select ok(not exists (select 1 from public.users where id = '66666666-6666-6666-6666-666666666666'), 'nieprzyjęte zaproszenie nie tworzy profilu');
select ok((select accepted_at is not null from public.invitations where email = 'uczennica.a@test.pl'), 'zaproszenie oznaczone jako przyjęte');

-- Przyjęcie zaproszenia (potwierdzenie e-maila) tworzy profil.
update auth.users set email_confirmed_at = now() where id = '66666666-6666-6666-6666-666666666666';
select ok(exists (select 1 from public.users where id = '66666666-6666-6666-6666-666666666666'), 'potwierdzenie e-maila tworzy profil');

-- ---------------------------------------------------------------------------
-- Uczennica salonu A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select results_eq('select name from public.salons', array['Salon A'], 'uczennica widzi tylko swój salon');
select is((select count(*)::int from public.users), 4, 'uczennica widzi tylko osoby swojego salonu');
select ok(not exists (select 1 from public.users where salon_id = 'b0000000-0000-0000-0000-00000000000b'), 'brak osób salonu B');
select is((select count(*)::int from public.invitations), 0, 'uczennica nie widzi zaproszeń');

select throws_ok(
  $$insert into public.invitations (email, role) values ('nowa@test.pl', 'apprentice')$$,
  '42501', null, 'uczennica nie może zapraszać');

select throws_ok(
  $$update public.users set role = 'owner' where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'uczennica nie zmieni swojej roli');

update public.users set deleted_at = now() where id = '33333333-3333-3333-3333-333333333333';
select ok(
  (select deleted_at is null from public.users where id = '33333333-3333-3333-3333-333333333333'),
  'uczennica nie dezaktywuje innej osoby');

select lives_ok(
  $$update public.users set full_name = 'Ania' where id = '22222222-2222-2222-2222-222222222222'$$,
  'uczennica zmienia swoje imię');

update public.users set full_name = 'Przejęte' where id = '33333333-3333-3333-3333-333333333333';
select is((select full_name from public.users where id = '33333333-3333-3333-3333-333333333333'), 'Uczennica 2 A', 'uczennica nie zmienia imienia innej osoby');

update public.salons set name = 'Zmienione' where id = 'a0000000-0000-0000-0000-00000000000a';
select is((select name from public.salons where id = 'a0000000-0000-0000-0000-00000000000a'), 'Salon A', 'uczennica nie edytuje salonu');

select throws_ok(
  $$update public.users set salon_id = 'b0000000-0000-0000-0000-00000000000b' where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'nie można zmienić salon_id');

select throws_ok(
  $$delete from public.users where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'DELETE na users zabroniony');

select throws_ok(
  $$insert into public.salons (name) values ('Nowy')$$,
  '42501', null, 'nie można zakładać salonów');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu A
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.invitations), 4, 'właścicielka widzi zaproszenia tylko swojego salonu');

select lives_ok(
  $$insert into public.invitations (email, role) values ('nowa@test.pl', 'apprentice')$$,
  'właścicielka zaprasza');
select is((select salon_id from public.invitations where email = 'nowa@test.pl'), 'a0000000-0000-0000-0000-00000000000a'::uuid, 'zaproszenie trafia do salonu właścicielki');

select throws_ok(
  $$insert into public.invitations (salon_id, email, role) values ('b0000000-0000-0000-0000-00000000000b', 'obca@test.pl', 'owner')$$,
  '42501', null, 'nie można zapraszać do cudzego salonu');

select throws_ok(
  $$update public.users set role = 'apprentice' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'właścicielka nie zmieni własnej roli');

select lives_ok(
  $$update public.salons set name = 'Creo' where id = 'a0000000-0000-0000-0000-00000000000a'$$,
  'właścicielka edytuje salon');

update public.users set full_name = 'X' where id = '44444444-4444-4444-4444-444444444444';
select is((select count(*)::int from public.users where id = '44444444-4444-4444-4444-444444444444'), 0, 'właścicielka nie widzi ani nie edytuje osób salonu B');

select throws_ok(
  $$delete from public.invitations where email = 'nowa@test.pl'$$,
  '42501', null, 'DELETE na invitations zabroniony');

select lives_ok(
  $$update public.users set deleted_at = now() where id = '33333333-3333-3333-3333-333333333333'$$,
  'właścicielka dezaktywuje uczennicę');

-- ---------------------------------------------------------------------------
-- Dezaktywowana uczennica traci dostęp
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is((select count(*)::int from public.salons), 0, 'dezaktywowana: brak salonu');
select is((select count(*)::int from public.users), 0, 'dezaktywowana: brak osób');

-- ---------------------------------------------------------------------------
-- Konto bez zaproszenia
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select is((select count(*)::int from public.salons), 0, 'bez zaproszenia: brak salonów');
select is((select count(*)::int from public.users), 0, 'bez zaproszenia: brak osób');
select is((select count(*)::int from public.invitations), 0, 'bez zaproszenia: brak zaproszeń');

-- ---------------------------------------------------------------------------
-- Anonim
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok('select * from public.salons', '42501', null, 'anon: brak dostępu do salons');
select throws_ok('select * from public.users', '42501', null, 'anon: brak dostępu do users');
select throws_ok('select * from public.invitations', '42501', null, 'anon: brak dostępu do invitations');

select * from finish();
rollback;
