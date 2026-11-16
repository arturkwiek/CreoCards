-- Testy – Etap 5 (attachments, zgoda na wizerunek, bucket photos i polityki Storage).
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

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
  ('b0000000-0000-0000-0000-00000000000b', 'wlascicielka.b@test.pl', 'owner', 'Właścicielka B');

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'wlascicielka.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'uczennica2.a@test.pl', now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'wlascicielka.b@test.pl', now(), 'authenticated', 'authenticated');

insert into public.clients (id, salon_id, full_name, phone, allergy_status, created_by, photo_consent_at) values
  ('c1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Bez Zgody', '600111222', 'none', '22222222-2222-2222-2222-222222222222', null),
  ('c1000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'Ze Zgodą', '600333444', 'none', '11111111-1111-1111-1111-111111111111', now()),
  ('c2000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Klientka B', '600555666', 'none', '44444444-4444-4444-4444-444444444444', null);

insert into public.visits (id, salon_id, client_id, created_by) values
  ('aa000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222'),
  ('aa000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111'),
  ('bb000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'c2000000-0000-0000-0000-0000000000b1', '44444444-4444-4444-4444-444444444444');

select ok((select relrowsecurity from pg_class where oid = 'public.attachments'::regclass), 'RLS włączone na attachments');
select is((select public from storage.buckets where id = 'photos'), false, 'bucket photos jest prywatny');
select is((select file_size_limit from storage.buckets where id = 'photos'), 5242880::bigint, 'limit 5 MB na plik');

-- ---------------------------------------------------------------------------
-- Uczennica A: dodaje zdjęcia do swojej wizyty
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok($$
  insert into public.attachments (id, visit_id, storage_path, thumb_path, mime, width, height, size_bytes, shows_face) values
  ('f1000000-0000-4000-8000-000000000001', 'aa000000-0000-0000-0000-0000000000a1',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000001.webp',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000001-m.webp',
   'image/webp', 1600, 1200, 200000, true)
$$, 'uczennica dodaje zdjęcie z twarzą do swojej wizyty');
select is((select consent_missing from public.attachments where id = 'f1000000-0000-4000-8000-000000000001'), true,
  'zdjęcie z twarzą bez zgody klientki – oznaczone consent_missing');
select is((select client_id from public.attachments where id = 'f1000000-0000-4000-8000-000000000001'),
  'c1000000-0000-0000-0000-0000000000a1'::uuid, 'client_id ustawiony z wizyty');

select lives_ok($$
  insert into public.attachments (id, visit_id, storage_path, thumb_path, mime, width, height, size_bytes, shows_face) values
  ('f1000000-0000-4000-8000-000000000002', 'aa000000-0000-0000-0000-0000000000a1',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000002.jpg',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000002-m.jpg',
   'image/jpeg', 1200, 1600, 150000, false)
$$, 'uczennica dodaje zdjęcie bez twarzy');
select is((select consent_missing from public.attachments where id = 'f1000000-0000-4000-8000-000000000002'), false,
  'zdjęcie bez twarzy – bez znacznika braku zgody');

select throws_ok($$
  insert into public.attachments (id, visit_id, storage_path, thumb_path, mime, width, height, size_bytes) values
  ('f1000000-0000-4000-8000-000000000003', 'aa000000-0000-0000-0000-0000000000a2',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a2/f1000000-0000-4000-8000-000000000003.webp',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a2/f1000000-0000-4000-8000-000000000003-m.webp',
   'image/webp', 10, 10, 100)
$$, '42501', null, 'uczennica nie dodaje zdjęcia do cudzej wizyty');

select throws_ok($$
  insert into public.attachments (id, visit_id, storage_path, thumb_path, mime, width, height, size_bytes) values
  ('f1000000-0000-4000-8000-000000000004', 'aa000000-0000-0000-0000-0000000000a1',
   'b0000000-0000-0000-0000-00000000000b/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000004.webp',
   'b0000000-0000-0000-0000-00000000000b/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000004-m.webp',
   'image/webp', 10, 10, 100)
$$, '23514', null, 'ścieżka pliku musi zaczynać się od własnego salonu i wizyty');

select throws_ok($$
  insert into public.attachments (id, visit_id, client_id, storage_path, thumb_path, mime, width, height, size_bytes) values
  ('f1000000-0000-4000-8000-000000000005', 'aa000000-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a2',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000005.webp',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000005-m.webp',
   'image/webp', 10, 10, 100)
$$, '42501', null, 'client_id nie jest ustawiany przez użytkownika');

-- Storage: wysyłanie plików
select lives_ok($$
  insert into storage.objects (bucket_id, name) values
  ('photos', 'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000001.webp')
$$, 'uczennica wysyła plik do swojej wizyty');
select throws_ok($$
  insert into storage.objects (bucket_id, name) values
  ('photos', 'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a2/f1000000-0000-4000-8000-000000000009.webp')
$$, '42501', null, 'uczennica nie wysyła pliku do cudzej wizyty');
select throws_ok($$
  insert into storage.objects (bucket_id, name) values
  ('photos', 'b0000000-0000-0000-0000-00000000000b/bb000000-0000-0000-0000-0000000000b1/f1000000-0000-4000-8000-000000000009.webp')
$$, '42501', null, 'uczennica nie wysyła pliku do innego salonu');
select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('photos', 'a0000000-0000-0000-0000-00000000000a/dowolny.png')
$$, '42501', null, 'niepoprawna nazwa pliku odrzucona');

select is((select count(*)::int from storage.objects where bucket_id = 'photos'), 1, 'uczennica widzi plik zapisanego zdjęcia');
select is((with u as (update storage.objects set name = name || '.x' where bucket_id = 'photos' returning 1) select count(*)::int from u),
  0, 'pliku nie da się zmienić');
select is((with d as (delete from storage.objects where bucket_id = 'photos' returning 1) select count(*)::int from d),
  0, 'pliku nie da się usunąć');
select throws_ok($$delete from public.attachments$$, '42501', null, 'brak twardego usuwania zdjęć');

-- Do kosza i (bez) przywracania
select lives_ok($$update public.attachments set deleted_at = now() where id = 'f1000000-0000-4000-8000-000000000001'$$,
  'uczennica przenosi zdjęcie ze swojej wizyty do kosza');
select is((select count(*)::int from storage.objects where bucket_id = 'photos'), 0, 'plik zdjęcia z kosza niewidoczny dla uczennicy');
select throws_ok($$update public.attachments set deleted_at = null where id = 'f1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'uczennica nie przywraca zdjęcia z kosza');

-- ---------------------------------------------------------------------------
-- Druga uczennica A: widzi, ale nie zmienia cudzych zdjęć
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is((select count(*)::int from public.attachments where visit_id = 'aa000000-0000-0000-0000-0000000000a1'), 2,
  'zespół widzi zdjęcia wizyt salonu');
select is((with u as (update public.attachments set deleted_at = now() where id = 'f1000000-0000-4000-8000-000000000002' returning 1)
  select count(*)::int from u), 0, 'druga uczennica nie przenosi cudzego zdjęcia do kosza');

-- ---------------------------------------------------------------------------
-- Właścicielka A: kosz, przywracanie, zgoda
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from storage.objects where bucket_id = 'photos'), 1, 'właścicielka widzi plik zdjęcia z kosza');
select lives_ok($$update public.attachments set deleted_at = null where id = 'f1000000-0000-4000-8000-000000000001'$$,
  'właścicielka przywraca zdjęcie z kosza');
select is((select count(*)::int from public.audit_log where table_name = 'attachments' and row_id = 'f1000000-0000-4000-8000-000000000001'),
  2, 'usunięcie i przywrócenie zdjęcia w historii');

select lives_ok($$
  insert into public.attachments (id, visit_id, storage_path, thumb_path, mime, width, height, size_bytes, shows_face) values
  ('f1000000-0000-4000-8000-000000000006', 'aa000000-0000-0000-0000-0000000000a2',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a2/f1000000-0000-4000-8000-000000000006.webp',
   'a0000000-0000-0000-0000-00000000000a/aa000000-0000-0000-0000-0000000000a2/f1000000-0000-4000-8000-000000000006-m.webp',
   'image/webp', 1600, 1200, 210000, true)
$$, 'właścicielka dodaje zdjęcie klientce ze zgodą');
select is((select consent_missing from public.attachments where id = 'f1000000-0000-4000-8000-000000000006'), false,
  'klientka ze zgodą – bez znacznika braku zgody');

update public.clients set photo_consent_at = now() where id = 'c1000000-0000-0000-0000-0000000000a1';
select lives_ok($$select public.restore_version((select max(id) from public.audit_log where table_name = 'clients' and row_id = 'c1000000-0000-0000-0000-0000000000a1'))$$,
  'właścicielka przywraca wersję klientki sprzed dopisania zgody');
select is((select photo_consent_at from public.clients where id = 'c1000000-0000-0000-0000-0000000000a1'), null,
  'restore_version przywraca też zgodę na zdjęcia');

-- ---------------------------------------------------------------------------
-- Właścicielka B: izolacja salonów
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is((select count(*)::int from public.attachments), 0, 'inny salon nie widzi zdjęć');
select is((select count(*)::int from storage.objects where bucket_id = 'photos'), 0, 'inny salon nie widzi plików');
select throws_ok($$
  insert into public.attachments (id, visit_id, storage_path, thumb_path, mime, width, height, size_bytes) values
  ('f1000000-0000-4000-8000-000000000007', 'aa000000-0000-0000-0000-0000000000a1',
   'b0000000-0000-0000-0000-00000000000b/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000007.webp',
   'b0000000-0000-0000-0000-00000000000b/aa000000-0000-0000-0000-0000000000a1/f1000000-0000-4000-8000-000000000007-m.webp',
   'image/webp', 10, 10, 100)
$$, '23503', null, 'inny salon nie dodaje zdjęcia do wizyty salonu A');

select * from finish();
rollback;
