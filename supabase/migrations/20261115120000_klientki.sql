-- Etap 2: klientki
-- Tabela clients. RLS: aktywna osoba (właścicielka lub uczennica) widzi, dodaje i edytuje
-- klientki wyłącznie swojego salonu. Miękkie usuwanie (deleted_at) tylko przez właścicielkę.
-- Migracja addytywna. Brak polityki DELETE.
-- Alergie i uwagi zdrowotne to dane wrażliwe: nie logujemy ich ani nie umieszczamy w URL-ach.

create type public.allergy_status as enum ('none', 'has');

comment on type public.allergy_status is 'none = brak znanych alergii, has = są alergie / uwagi zdrowotne';

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  phone text not null check (length(regexp_replace(phone, '\D', '', 'g')) between 7 and 15),
  -- Same cyfry numeru – do wyszukiwania po fragmencie telefonu.
  phone_digits text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  allergy_status public.allergy_status not null,
  allergies text not null default '' check (length(allergies) <= 2000),
  email text check (email is null or (email = lower(email) and position('@' in email) > 1 and length(email) <= 254)),
  note text not null default '' check (length(note) <= 2000),
  rodo_consent_at timestamptz,
  notifications_consent_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.clients is 'Klientki salonu. Pola obowiązkowe: imię i nazwisko, telefon, wybór alergii.';
comment on column public.clients.allergies is 'Dane wrażliwe (zdrowotne). Opis alergii / uwag; wypełniany, gdy allergy_status = has.';
comment on column public.clients.deleted_at is 'Miękkie usunięcie – ustawia tylko właścicielka.';

-- Lista: aktywne klientki salonu, ostatnio zmienione na górze.
create index clients_salon_updated_idx on public.clients (salon_id, updated_at desc) where deleted_at is null;
-- Ostrzeżenie o tym samym numerze i wyszukiwanie po telefonie.
create index clients_salon_phone_idx on public.clients (salon_id, phone_digits);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ochrona: miękkie usuwanie (i przywracanie) tylko przez właścicielkę.
-- Dotyczy wyłącznie roli authenticated (service_role/postgres pomijane).
-- ---------------------------------------------------------------------------

create function public.clients_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at and not public.is_owner() then
    raise exception 'Tylko właścicielka może usuwać klientki'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger clients_guard_update
before update on public.clients
for each row execute function public.clients_guard_update();

-- ---------------------------------------------------------------------------
-- Uprawnienia (najmniejsze potrzebne) + Row Level Security
-- salon_id i created_by pochodzą wyłącznie z wartości domyślnych (brak grantu na te kolumny).
-- ---------------------------------------------------------------------------

alter table public.clients enable row level security;

revoke all on public.clients from anon, authenticated;

grant select on public.clients to authenticated;
grant insert (full_name, phone, allergy_status, allergies, email, note, rodo_consent_at, notifications_consent_at)
  on public.clients to authenticated;
grant update (full_name, phone, allergy_status, allergies, email, note, rodo_consent_at, notifications_consent_at, deleted_at)
  on public.clients to authenticated;

create policy clients_select on public.clients
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy clients_insert on public.clients
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and deleted_at is null
  );

create policy clients_update on public.clients
  for update to authenticated
  using (salon_id = public.current_salon_id())
  with check (salon_id = public.current_salon_id());
