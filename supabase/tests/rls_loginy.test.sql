-- Testy – Etap 1b (loginy, login_attempts, login_throttled, record_login_attempt).
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Dane testowe
-- ---------------------------------------------------------------------------

insert into public.salons (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B');

insert into public.invitations (salon_id, email, role, full_name, login) values
  ('a0000000-0000-0000-0000-00000000000a', 'wlascicielka.a@test.pl', 'owner', 'Właścicielka A', null),
  ('a0000000-0000-0000-0000-00000000000a', 'ania.a0000000@konta.creocards.studiocreotarnow.pl', 'apprentice', 'Ania', 'ania'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica.a@test.pl', 'apprentice', 'Basia', null),
  ('b0000000-0000-0000-0000-00000000000b', 'ania.b0000000@konta.creocards.studiocreotarnow.pl', 'apprentice', 'Ania B', 'ania');

-- Konta potwierdzone od razu (jak admin.createUser z email_confirm) – trigger zakłada profile.
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'wlascicielka.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'ania.a0000000@konta.creocards.studiocreotarnow.pl', now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'ania.b0000000@konta.creocards.studiocreotarnow.pl', now(), 'authenticated', 'authenticated');

-- ---------------------------------------------------------------------------
-- Schemat
-- ---------------------------------------------------------------------------

select is((select login from public.users where id = '22222222-2222-2222-2222-222222222222'), 'ania', 'profil dostaje login z zaproszenia');
select is((select login from public.users where id = '44444444-4444-4444-4444-444444444444'), 'ania', 'ten sam login w innym salonie dozwolony');
select is((select login from public.users where id = '33333333-3333-3333-3333-333333333333'), null, 'konto z e-mailem bez loginu działa jak dotąd');
select throws_ok(
  $$update public.users set login = 'Ania!' where id = '33333333-3333-3333-3333-333333333333'$$,
  '23514', null, 'login: tylko małe litery, cyfry, kropka, myślnik');
select throws_ok(
  $$update public.users set login = 'ab' where id = '33333333-3333-3333-3333-333333333333'$$,
  '23514', null, 'login: co najmniej 3 znaki');
select throws_ok(
  $$update public.users set login = 'ania' where id = '33333333-3333-3333-3333-333333333333'$$,
  '23505', null, 'login unikalny w salonie');
select throws_ok(
  $$insert into public.invitations (salon_id, email, role, login) values ('a0000000-0000-0000-0000-00000000000a', 'x@test.pl', 'apprentice', 'nowa'), ('a0000000-0000-0000-0000-00000000000a', 'y@test.pl', 'apprentice', 'nowa')$$,
  '23505', null, 'dwa oczekujące zaproszenia z tym samym loginem odrzucone');

-- ---------------------------------------------------------------------------
-- Uczennica salonu A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $$update public.users set login = 'basia' where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'uczennica nie nadaje sobie loginu');
update public.users set login = 'zmieniona' where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is((select login from public.users where id = '22222222-2222-2222-2222-222222222222'), 'ania', 'uczennica nie zmienia cudzego loginu');
set local role authenticated;
select throws_ok(
  $$insert into public.invitations (email, role, login) values ('z@test.pl', 'apprentice', 'zosia')$$,
  '42501', null, 'uczennica nie zakłada kont (zaproszeń)');
select is((select count(*)::int from public.invitations), 0, 'uczennica nie widzi zaproszeń (Zespół)');

-- ---------------------------------------------------------------------------
-- Właścicielka salonu A
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.users set login = 'basia' where id = '33333333-3333-3333-3333-333333333333'$$,
  'właścicielka nadaje login istniejącemu kontu');
select throws_ok(
  $$update public.users set login = 'basia' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23505', null, 'właścicielka: zajęty login odrzucony');
select lives_ok(
  $$update public.users set login = 'kinga' where id = '11111111-1111-1111-1111-111111111111'$$,
  'właścicielka może mieć login (oprócz e-maila)');
select lives_ok(
  $$insert into public.invitations (email, role, full_name, login) values ('zosia.a0000000@konta.creocards.studiocreotarnow.pl', 'apprentice', 'Zosia', 'zosia')$$,
  'właścicielka zakłada konto loginem');
select is((select count(*)::int from public.users where login = 'ania'), 1, 'właścicielka A nie widzi loginów salonu B');

-- ---------------------------------------------------------------------------
-- login_attempts i funkcje limitu – tylko service_role
-- ---------------------------------------------------------------------------

select throws_ok('select * from public.login_attempts', '42501', null, 'authenticated: brak dostępu do login_attempts');
select throws_ok(
  $$select public.login_throttled('aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb')$$,
  '42501', null, 'authenticated: brak dostępu do login_throttled');
reset role;
set local role anon;
select throws_ok(
  $$select public.record_login_attempt('aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb', false)$$,
  '42501', null, 'anon: brak dostępu do record_login_attempt');

reset role;
set local role service_role;

do $$ begin perform public.record_login_attempt('login-hash-0000000001', 'ip-hash-00000000000001', false) from generate_series(1, 4); end $$;
select is(public.login_throttled('login-hash-0000000001', 'ip-hash-00000000000001'), false, '4 nieudane próby – bez blokady');
do $$ begin perform public.record_login_attempt('login-hash-0000000001', 'ip-hash-00000000000001', false); end $$;
select is(public.login_throttled('login-hash-0000000001', 'ip-hash-00000000000002'), true, '5 nieudanych prób na login – blokada (także z innego IP)');

do $$ begin perform public.record_login_attempt('login-hash-0000000001', 'ip-hash-00000000000001', true); end $$;
select is(public.login_throttled('login-hash-0000000001', 'ip-hash-00000000000003'), false, 'udane logowanie zeruje licznik loginu');

do $$ begin perform public.record_login_attempt('login-hash-' || lpad(g::text, 10, '0') || 'x', 'ip-hash-00000000000009', false) from generate_series(1, 20) g; end $$;
select is(public.login_throttled('login-hash-nowy-000000', 'ip-hash-00000000000009'), true, '20 nieudanych prób z jednego IP – blokada');

insert into public.login_attempts (login_hash, ip_hash, success, attempted_at)
values ('login-hash-stary-00000', 'ip-hash-stary-0000000', false, now() - interval '8 days');
do $$ begin perform public.record_login_attempt('login-hash-0000000002', 'ip-hash-00000000000002', true); end $$;
select ok(
  not exists (select 1 from public.login_attempts where login_hash = 'login-hash-stary-00000'),
  'wpisy starsze niż 7 dni czyszczone automatycznie');

select * from finish();
rollback;
