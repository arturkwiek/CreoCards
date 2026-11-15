-- Etap 1b: loginy – konta bez e-maila
-- users.login / invitations.login (unikalny w salonie; nadaje i zmienia tylko właścicielka).
-- Konto bez e-maila ma adres techniczny <login>.<8 znaków id salonu>@konta.creocards.studiocreotarnow.pl
-- (domena bez MX, nic nie jest wysyłane; adres nie pojawia się w UI).
-- login_attempts: limit nieudanych logowań na login i IP (skróty HMAC, bez jawnych wartości),
-- dostęp wyłącznie service_role; wpisy starsze niż 7 dni czyszczone automatycznie.
-- Migracja addytywna (nowe kolumny, tabela, funkcje; nowe wersje funkcji triggerów).

-- ---------------------------------------------------------------------------
-- Login
-- ---------------------------------------------------------------------------

alter table public.users
  add column login text check (login is null or login ~ '^[a-z0-9.-]{3,30}$');

comment on column public.users.login is 'Login (małe litery, cyfry, kropka, myślnik; 3–30). Unikalny w salonie, także dla kont dezaktywowanych.';

create unique index users_salon_login_uidx on public.users (salon_id, login) where login is not null;

alter table public.invitations
  add column login text check (login is null or login ~ '^[a-z0-9.-]{3,30}$');

create unique index invitations_pending_login_uidx
  on public.invitations (salon_id, login)
  where login is not null and accepted_at is null and deleted_at is null;

grant update (login) on public.users to authenticated;
grant insert (login) on public.invitations to authenticated;

-- Nowa wersja ochrony kolumn users: dodatkowo login nadaje i zmienia tylko właścicielka.
create or replace function public.users_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.role is distinct from old.role or new.deleted_at is distinct from old.deleted_at then
    if not public.is_owner() then
      raise exception 'Tylko właścicielka może zmieniać role i dezaktywować konta'
        using errcode = '42501';
    end if;
    if new.id = (select auth.uid()) then
      raise exception 'Nie można zmienić własnej roli ani dezaktywować własnego konta'
        using errcode = '42501';
    end if;
  end if;

  if new.login is distinct from old.login and not public.is_owner() then
    raise exception 'Login nadaje tylko właścicielka'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Nowa wersja zakładania profilu: przepisuje też login z zaproszenia.
create or replace function public.handle_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations%rowtype;
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;

  if exists (select 1 from public.users u where u.id = new.id) then
    return new;
  end if;

  select i.* into inv
  from public.invitations i
  where i.email = lower(new.email)
    and i.accepted_at is null
    and i.deleted_at is null
  order by i.created_at desc
  limit 1;

  if not found then
    return new;
  end if;

  insert into public.users (id, salon_id, role, full_name, email, login, created_by)
  values (new.id, inv.salon_id, inv.role, inv.full_name, lower(new.email), inv.login, inv.created_by);

  update public.invitations set accepted_at = now() where id = inv.id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Limit nieudanych logowań (dane techniczne, nie dane salonu – bez salon_id)
-- ---------------------------------------------------------------------------

create table public.login_attempts (
  id bigint generated always as identity primary key,
  login_hash text not null check (length(login_hash) between 16 and 128),
  ip_hash text not null check (length(ip_hash) between 16 and 128),
  success boolean not null,
  attempted_at timestamptz not null default now()
);

comment on table public.login_attempts is 'Próby logowania (skróty HMAC loginu i IP). Tylko service_role. Wpisy > 7 dni usuwane automatycznie.';

create index login_attempts_login_idx on public.login_attempts (login_hash, attempted_at desc);
create index login_attempts_ip_idx on public.login_attempts (ip_hash, attempted_at desc);
create index login_attempts_time_idx on public.login_attempts (attempted_at);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from public, anon, authenticated;

-- Czy logowanie jest zablokowane: 5 nieudanych prób na login lub 20 na IP w ciągu 15 minut,
-- licząc od ostatniego udanego logowania (udane logowanie zeruje licznik).
create function public.login_throttled(p_login_hash text, p_ip_hash text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (
      select count(*) from public.login_attempts a
      where a.login_hash = p_login_hash
        and not a.success
        and a.attempted_at > now() - interval '15 minutes'
        and a.attempted_at > coalesce(
          (select max(s.attempted_at) from public.login_attempts s where s.login_hash = p_login_hash and s.success),
          '-infinity'::timestamptz)
    ) >= 5
    or (
      select count(*) from public.login_attempts a
      where a.ip_hash = p_ip_hash
        and not a.success
        and a.attempted_at > now() - interval '15 minutes'
        and a.attempted_at > coalesce(
          (select max(s.attempted_at) from public.login_attempts s where s.ip_hash = p_ip_hash and s.success),
          '-infinity'::timestamptz)
    ) >= 20;
$$;

-- Zapis próby + automatyczne czyszczenie wpisów starszych niż 7 dni.
create function public.record_login_attempt(p_login_hash text, p_ip_hash text, p_success boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.login_attempts (login_hash, ip_hash, success) values (p_login_hash, p_ip_hash, p_success);
  delete from public.login_attempts where attempted_at < now() - interval '7 days';
$$;

revoke execute on function public.login_throttled(text, text) from public, anon, authenticated;
revoke execute on function public.record_login_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.login_throttled(text, text) to service_role;
grant execute on function public.record_login_attempt(text, text, boolean) to service_role;
grant select, insert, delete on public.login_attempts to service_role;
