-- Testy – etap „Grafik” (appointments) i status alergii „nieuzupełnione”.
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

-- Liczba wierszy zmienionych przez polecenie (z RLS osoby wywołującej).
create function pg_temp.affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Dane testowe
-- ---------------------------------------------------------------------------

insert into public.salons (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B');

insert into public.invitations (salon_id, email, role, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'wlascicielka.a@test.pl', 'owner', 'Właścicielka A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica.a@test.pl', 'apprentice', 'Uczennica A'),
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica2.a@test.pl', 'apprentice', 'Uczennica A2'),
  ('a0000000-0000-0000-0000-00000000000a', 'byla.a@test.pl', 'apprentice', 'Była A'),
  ('b0000000-0000-0000-0000-00000000000b', 'wlascicielka.b@test.pl', 'owner', 'Właścicielka B');

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'wlascicielka.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'uczennica2.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'byla.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'wlascicielka.b@test.pl', now(), 'authenticated', 'authenticated');

update public.users set deleted_at = now() where id = '55555555-5555-5555-5555-555555555555';

insert into public.clients (id, salon_id, full_name, phone, allergy_status, created_by) values
  ('c1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Znana', '600111222', 'none', '11111111-1111-1111-1111-111111111111'),
  ('c1000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'Nowa z telefonu', '600333444', 'unknown', '11111111-1111-1111-1111-111111111111'),
  ('c2000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Klientka B', '600555666', 'none', '44444444-4444-4444-4444-444444444444');

insert into public.product_lines (id, salon_id, brand, name, created_by) values
  ('d1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Alfa', 'Linia', '11111111-1111-1111-1111-111111111111');
insert into public.products (id, salon_id, line_id, shade, type, created_by) values
  ('e1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-0000000000a1', '7.1', 'farba', '11111111-1111-1111-1111-111111111111');

insert into public.visits (id, salon_id, client_id, created_by) values
  ('aa000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-0000000000a2', '22222222-2222-2222-2222-222222222222');

insert into public.appointments (id, salon_id, staff_id, client_id, starts_at, created_by) values
  ('ab000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', '44444444-4444-4444-4444-444444444444',
   'c2000000-0000-0000-0000-0000000000b1', '2026-12-01 10:00+01', '44444444-4444-4444-4444-444444444444');

select ok((select relrowsecurity from pg_class where oid = 'public.appointments'::regclass), 'RLS włączone na appointments');
select is((select count(*)::int from pg_policies where tablename = 'appointments' and cmd = 'DELETE'), 0,
  'brak polityki DELETE na appointments (tylko miękkie usuwanie)');
select ok('unknown' = any (enum_range(null::public.allergy_status)::text[]), 'status alergii „unknown” istnieje');

-- ---------------------------------------------------------------------------
-- Uczennica A: swoje terminy
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok($$
  insert into public.appointments (id, client_id, starts_at, duration_min) values
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-0000000000a1', '2026-12-01 10:00+01', 90)
$$, 'uczennica dodaje termin sobie (staff_id domyślnie = ona)');
select is((select staff_id from public.appointments where id = 'a1000000-0000-0000-0000-000000000001'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'staff_id = osoba zalogowana');
select is((select status::text from public.appointments where id = 'a1000000-0000-0000-0000-000000000001'), 'umowiona',
  'domyślny status: umówiona');

select throws_ok($$
  insert into public.appointments (staff_id, client_id, starts_at) values
  ('33333333-3333-3333-3333-333333333333', 'c1000000-0000-0000-0000-0000000000a1', '2026-12-01 12:00+01')
$$, '42501', null, 'uczennica nie doda terminu innej osobie');

select throws_ok($$
  insert into public.appointments (client_id, starts_at) values
  ('c2000000-0000-0000-0000-0000000000b1', '2026-12-01 12:00+01')
$$, '23503', null, 'termin z klientką innego salonu – odrzucony (klucz obcy z salonem)');

select throws_ok($$
  insert into public.appointments (client_id, starts_at, duration_min) values
  ('c1000000-0000-0000-0000-0000000000a1', '2026-12-01 12:00+01', 2)
$$, '23514', null, 'czas trwania poniżej 5 min – odrzucony');

select lives_ok($$
  insert into public.appointments (client_id, starts_at) values
  ('c1000000-0000-0000-0000-0000000000a2', '2026-12-02 09:00+01')
$$, 'termin z klientką o alergiach „nieuzupełnione” zapisuje się bez wyboru alergii');

select is(pg_temp.affected($$update public.appointments set note = 'Kolor jak ostatnio' where id = 'a1000000-0000-0000-0000-000000000001'$$), 1,
  'uczennica zmienia swój termin');

select throws_ok($$
  update public.appointments set staff_id = '33333333-3333-3333-3333-333333333333' where id = 'a1000000-0000-0000-0000-000000000001'
$$, '42501', null, 'uczennica nie przepnie swojego terminu na inną osobę');

select is((select count(*)::int from public.appointments where salon_id = 'b0000000-0000-0000-0000-00000000000b'), 0,
  'uczennica nie widzi terminów innego salonu');

select is(pg_temp.affected($$update public.appointments set deleted_at = now() where id = 'a1000000-0000-0000-0000-000000000001'$$), 1,
  'uczennica przenosi swój termin do kosza');

select throws_ok($$
  update public.appointments set deleted_at = null where id = 'a1000000-0000-0000-0000-000000000001'
$$, '42501', null, 'uczennica nie przywraca terminu z kosza');

-- ---------------------------------------------------------------------------
-- Właścicielka A: terminy całego zespołu
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok($$
  insert into public.appointments (id, staff_id, client_id, starts_at, duration_min) values
  ('a1000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'c1000000-0000-0000-0000-0000000000a1', '2026-12-01 11:00+01', 60)
$$, 'właścicielka dodaje termin uczennicy');

select throws_ok($$
  insert into public.appointments (staff_id, client_id, starts_at) values
  ('55555555-5555-5555-5555-555555555555', 'c1000000-0000-0000-0000-0000000000a1', '2026-12-01 11:00+01')
$$, '42501', null, 'nie da się przypisać terminu osobie dezaktywowanej');

select throws_ok($$
  insert into public.appointments (staff_id, client_id, starts_at) values
  ('44444444-4444-4444-4444-444444444444', 'c1000000-0000-0000-0000-0000000000a1', '2026-12-01 11:00+01')
$$, '42501', null, 'nie da się przypisać terminu osobie z innego salonu');

select throws_ok($$
  insert into public.appointments (client_id, starts_at, visit_id) values
  ('c1000000-0000-0000-0000-0000000000a1', '2026-12-01 13:00+01', 'aa000000-0000-0000-0000-0000000000a1')
$$, '42501', null, 'nowy termin nie może od razu wskazywać wizyty (powiązanie tylko przy „Nowa wizyta”)');

select is(pg_temp.affected($$update public.appointments set staff_id = '22222222-2222-2222-2222-222222222222' where id = 'a1000000-0000-0000-0000-000000000002'$$), 1,
  'właścicielka przepina termin na inną osobę');

select throws_ok($$
  update public.appointments set staff_id = '55555555-5555-5555-5555-555555555555' where id = 'a1000000-0000-0000-0000-000000000002'
$$, '42501', null, 'właścicielka nie przepnie terminu na osobę dezaktywowaną');

select is(pg_temp.affected($$update public.appointments set deleted_at = null where id = 'a1000000-0000-0000-0000-000000000001'$$), 1,
  'właścicielka przywraca termin z kosza');

select ok(exists (select 1 from public.audit_log where table_name = 'appointments' and row_id = 'a1000000-0000-0000-0000-000000000001' and action = 'delete'),
  'usunięcie terminu w historii zmian');
select ok(exists (select 1 from public.audit_log where table_name = 'appointments' and row_id = 'a1000000-0000-0000-0000-000000000001' and action = 'restore'),
  'przywrócenie terminu w historii zmian');

select lives_ok($$
  select public.restore_version((select id from public.audit_log
    where table_name = 'appointments' and row_id = 'a1000000-0000-0000-0000-000000000002' and action = 'update'
    order by id desc limit 1))
$$, 'właścicielka przywraca poprzednią wersję terminu');
select is((select staff_id from public.appointments where id = 'a1000000-0000-0000-0000-000000000002'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'po przywróceniu wersji termin wraca do poprzedniej osoby');

select is(pg_temp.affected($$update public.appointments set status = 'odbyla_sie', visit_id = 'aa000000-0000-0000-0000-0000000000a1' where id = 'a1000000-0000-0000-0000-000000000002'$$), 1,
  'termin powiązany z wizytą i oznaczony „odbyła się”');

select lives_ok($$
  insert into public.appointments (client_id, starts_at) values ('c1000000-0000-0000-0000-0000000000a1', '2026-12-03 10:00+01')
$$, 'właścicielka dodaje sobie termin');
select throws_ok($$
  update public.appointments set visit_id = 'aa000000-0000-0000-0000-0000000000a1'
  where starts_at = '2026-12-03 10:00+01'
$$, '23505', null, 'jedna wizyta może być powiązana tylko z jednym terminem');

-- ---------------------------------------------------------------------------
-- Uczennica A2: widzi grafik zespołu, ale nie zmienia cudzych terminów
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select ok((select count(*)::int from public.appointments where staff_id = '22222222-2222-2222-2222-222222222222') >= 1,
  'uczennica widzi terminy innych osób z zespołu (do odczytu)');
select is(pg_temp.affected($$update public.appointments set note = 'x' where id = 'a1000000-0000-0000-0000-000000000001'$$), 0,
  'uczennica nie zmienia cudzego terminu');
select is(pg_temp.affected($$update public.appointments set note = 'Moje' where id = 'a1000000-0000-0000-0000-000000000002'$$), 1,
  'uczennica zmienia termin przypisany jej przez właścicielkę');

-- ---------------------------------------------------------------------------
-- Alergie „nieuzupełnione”: receptura zablokowana do czasu wyboru
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok($$
  select public.save_recipe('aa000000-0000-0000-0000-0000000000a1',
    '{"note":"","mixes":[{"zone":"calosc","oxidant_percent":null,"items":[{"product_id":"e1000000-0000-0000-0000-0000000000a1","grams":30}]}]}'::jsonb)
$$, '23514', 'Zapytaj o alergie przed nałożeniem farby', 'receptura z farbą dla klientki z alergiami „nieuzupełnione” – odrzucona');

select lives_ok($$
  select public.save_recipe('aa000000-0000-0000-0000-0000000000a1', '{"note":"Tylko strzyżenie","mixes":[]}'::jsonb)
$$, 'wizyta z samą notatką (bez farb) zapisuje się mimo alergii „nieuzupełnione”');

select lives_ok($$
  update public.clients set allergy_status = 'none' where id = 'c1000000-0000-0000-0000-0000000000a2'
$$, 'wybór „Brak znanych alergii”');

select lives_ok($$
  select public.save_recipe('aa000000-0000-0000-0000-0000000000a1',
    '{"note":"","mixes":[{"zone":"calosc","oxidant_percent":null,"items":[{"product_id":"e1000000-0000-0000-0000-0000000000a1","grams":30}]}]}'::jsonb)
$$, 'po wyborze alergii receptura zapisuje się');

-- ---------------------------------------------------------------------------
-- Inny salon i anon
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is((select count(*)::int from public.appointments where salon_id = 'a0000000-0000-0000-0000-00000000000a'), 0,
  'właścicielka innego salonu nie widzi terminów salonu A');

reset role;
set local role anon;
select throws_ok($$select count(*) from public.appointments$$, '42501', null, 'anon nie ma dostępu do terminów');

select * from finish();
rollback;
