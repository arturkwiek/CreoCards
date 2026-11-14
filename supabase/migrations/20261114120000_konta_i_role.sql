-- Etap 1: konta i role
-- Tabele: salons, users, invitations. RLS: użytkownik widzi wyłącznie dane swojego salonu.
-- Migracja addytywna. Brak polityk DELETE – miękkie usuwanie przez deleted_at.

-- ---------------------------------------------------------------------------
-- Typy i funkcje wspólne
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('owner', 'apprentice');

comment on type public.user_role is 'owner = właścicielka, apprentice = uczennica';

-- Wspólny trigger updated_at (używany też w kolejnych etapach).
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- salons
-- ---------------------------------------------------------------------------

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.salons is 'Salon (najemca). id pełni rolę salon_id dla pozostałych tabel.';

create trigger salons_set_updated_at
before update on public.salons
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- users (profil pracownika salonu, 1:1 z auth.users)
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id),
  salon_id uuid not null references public.salons (id),
  role public.user_role not null default 'apprentice',
  full_name text not null default '',
  email text not null unique check (email = lower(email)),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.users.deleted_at is 'Dezaktywacja konta: ustawione = brak dostępu do danych salonu.';

create index users_salon_id_idx on public.users (salon_id);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funkcje pomocnicze RLS (SECURITY DEFINER – bez rekurencji polityk)
-- ---------------------------------------------------------------------------

-- Salon zalogowanej osoby; NULL, gdy konto dezaktywowane, brak profilu lub salon usunięty.
create function public.current_salon_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.salon_id
  from public.users u
  join public.salons s on s.id = u.salon_id
  where u.id = (select auth.uid())
    and u.deleted_at is null
    and s.deleted_at is null;
$$;

-- Czy zalogowana osoba jest aktywną właścicielką.
create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.deleted_at is null
      and u.role = 'owner'
      and u.salon_id = public.current_salon_id()
  );
$$;

revoke execute on function public.current_salon_id() from public, anon;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.current_salon_id() to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role public.user_role not null default 'apprentice',
  full_name text not null default '',
  accepted_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index invitations_salon_id_idx on public.invitations (salon_id);

-- Najwyżej jedno oczekujące zaproszenie na adres e-mail.
create unique index invitations_pending_email_uidx
  on public.invitations (email)
  where accepted_at is null and deleted_at is null;

create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ochrona kolumn users: rolę i dezaktywację zmienia tylko właścicielka,
-- nikt nie zmienia własnej roli ani nie dezaktywuje samej siebie.
-- Dotyczy wyłącznie roli authenticated (service_role/postgres pomijane).
-- ---------------------------------------------------------------------------

create function public.users_guard_update()
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

  return new;
end;
$$;

create trigger users_guard_update
before update on public.users
for each row execute function public.users_guard_update();

-- ---------------------------------------------------------------------------
-- Profil tworzony dopiero po przyjęciu zaproszenia (potwierdzenie e-maila).
-- salon_id i rola pochodzą wyłącznie z tabeli invitations, nie z metadanych
-- użytkownika. Konto bez zaproszenia nie dostaje profilu => brak dostępu.
-- ---------------------------------------------------------------------------

create function public.handle_auth_user_confirmed()
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

  insert into public.users (id, salon_id, role, full_name, email, created_by)
  values (new.id, inv.salon_id, inv.role, inv.full_name, lower(new.email), inv.created_by);

  update public.invitations set accepted_at = now() where id = inv.id;

  return new;
end;
$$;

revoke execute on function public.handle_auth_user_confirmed() from public, anon, authenticated;

create trigger on_auth_user_confirmed
after insert or update of email_confirmed_at on auth.users
for each row execute function public.handle_auth_user_confirmed();

-- ---------------------------------------------------------------------------
-- Uprawnienia (najmniejsze potrzebne) + Row Level Security
-- ---------------------------------------------------------------------------

alter table public.salons enable row level security;
alter table public.users enable row level security;
alter table public.invitations enable row level security;

revoke all on public.salons, public.users, public.invitations from anon, authenticated;

grant select on public.salons, public.users, public.invitations to authenticated;
grant update (name) on public.salons to authenticated;
grant update (full_name, role, deleted_at) on public.users to authenticated;
grant insert (email, role, full_name) on public.invitations to authenticated;
grant update (deleted_at) on public.invitations to authenticated;

-- salons
create policy salons_select on public.salons
  for select to authenticated
  using (id = public.current_salon_id());

create policy salons_update_owner on public.salons
  for update to authenticated
  using (id = public.current_salon_id() and public.is_owner())
  with check (id = public.current_salon_id() and public.is_owner());

-- users
create policy users_select on public.users
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy users_update on public.users
  for update to authenticated
  using (salon_id = public.current_salon_id() and (id = (select auth.uid()) or public.is_owner()))
  with check (salon_id = public.current_salon_id());

-- invitations
create policy invitations_select_owner on public.invitations
  for select to authenticated
  using (salon_id = public.current_salon_id() and public.is_owner());

create policy invitations_insert_owner on public.invitations
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and public.is_owner()
    and created_by = (select auth.uid())
  );

create policy invitations_update_owner on public.invitations
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.is_owner())
  with check (salon_id = public.current_salon_id() and public.is_owner());
