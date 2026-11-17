-- Testy – nazwa salonu na stronie „Kontynuuj” (link_salon_name).
-- Uruchomienie: npx supabase test db
-- Wyłącznie dane testowe.
begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.salons (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B');

insert into public.invitations (salon_id, email, role, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'uczennica.a@test.pl', 'apprentice', 'Uczennica A');

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('22222222-2222-2222-2222-222222222222', 'uczennica.a@test.pl', now(), 'authenticated', 'authenticated');

-- Link do ustawienia hasła (konto z profilem) i zaproszenie e-mailem (bez profilu).
update auth.users set recovery_token = 'reset-token-hash-0000000000000000000000' where id = '22222222-2222-2222-2222-222222222222';
insert into public.invitations (salon_id, email, role, full_name) values
  ('b0000000-0000-0000-0000-00000000000b', 'nowa.b@test.pl', 'apprentice', 'Nowa B');
insert into auth.users (id, email, aud, role, confirmation_token) values
  ('55555555-5555-5555-5555-555555555555', 'nowa.b@test.pl', 'authenticated', 'authenticated', 'invite-token-hash-000000000000000000000');

select is(public.link_salon_name('reset-token-hash-0000000000000000000000'), 'Salon A', 'link ustawienia hasła → salon konta');
select is(public.link_salon_name('invite-token-hash-000000000000000000000'), 'Salon B', 'zaproszenie e-mailem → salon z zaproszenia');
select is(public.link_salon_name('nieznany-token-0000000000000000000000000'), null, 'nieznany token → brak salonu');
select is(public.link_salon_name(''), null, 'pusty token → brak salonu (nie dopasowuje pustych tokenów)');

update public.users set deleted_at = now() where id = '22222222-2222-2222-2222-222222222222';
select is(public.link_salon_name('reset-token-hash-0000000000000000000000'), null, 'konto dezaktywowane → brak salonu');

select ok(not has_function_privilege('anon', 'public.link_salon_name(text)', 'execute'), 'anon nie wywołuje funkcji');
select ok(not has_function_privilege('authenticated', 'public.link_salon_name(text)', 'execute'), 'zalogowani nie wywołują funkcji');

select * from finish();
rollback;
