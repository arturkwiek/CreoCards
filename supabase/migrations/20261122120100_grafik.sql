-- Etap „Grafik”: terminy klientek przypisane do osoby z zespołu.
-- RLS: czyta cały zespół salonu; dodaje i zmienia osoba, do której należy termin, albo właścicielka
-- (termin dla innej osoby – tylko właścicielka). Miękkie usuwanie przez osobę z prawem edycji,
-- przywracanie z kosza tylko przez właścicielkę. Historia zmian jak przy wizytach.
-- Receptura u klientki z alergiami „nieuzupełnione” – zablokowana w bazie (najpierw wybór alergii).
-- Migracja addytywna (nowy typ, tabela, indeksy, funkcje, triggery, polityki; nowa wersja restore_version).

create type public.appointment_status as enum ('umowiona', 'odbyla_sie', 'odwolana', 'nie_przyszla');

comment on type public.appointment_status is 'Status terminu: umówiona, odbyła się, odwołana, nie przyszła';

-- Klucz do powiązania terminu z osobą z tego samego salonu.
create unique index users_id_salon_id_key on public.users (id, salon_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  staff_id uuid not null default auth.uid(),
  client_id uuid not null,
  service_id uuid,
  starts_at timestamptz not null check (starts_at >= '2000-01-01'),
  duration_min integer not null default 60 check (duration_min between 5 and 720),
  note text not null default '' check (length(note) <= 300),
  status public.appointment_status not null default 'umowiona',
  visit_id uuid,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (staff_id, salon_id) references public.users (id, salon_id),
  foreign key (client_id, salon_id) references public.clients (id, salon_id),
  foreign key (service_id, salon_id) references public.services (id, salon_id),
  foreign key (visit_id, salon_id) references public.visits (id, salon_id)
);

comment on table public.appointments is 'Terminy klientek (grafik). staff_id = osoba, która wykona usługę.';
comment on column public.appointments.visit_id is 'Wizyta zapisana z tego terminu („Nowa wizyta”).';

-- Dzień osoby i widok wszystkich.
create index appointments_staff_day_idx on public.appointments (salon_id, staff_id, starts_at) where deleted_at is null;
create index appointments_day_idx on public.appointments (salon_id, starts_at) where deleted_at is null;
-- Nadchodzące terminy na karcie klientki.
create index appointments_client_idx on public.appointments (salon_id, client_id, starts_at) where deleted_at is null;
-- Jedna wizyta = jeden termin.
create unique index appointments_visit_uidx on public.appointments (visit_id) where visit_id is not null and deleted_at is null;

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

-- Aktywna osoba z salonu zalogowanej osoby (komu można przypisać termin).
create function public.is_salon_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = p_user_id
      and u.salon_id = public.current_salon_id()
      and u.deleted_at is null
  );
$$;

revoke execute on function public.is_salon_member(uuid) from public, anon;
grant execute on function public.is_salon_member(uuid) to authenticated;

-- Ochrona zmian: przepięcie na inną osobę tylko przez właścicielkę i tylko na aktywną osobę z salonu;
-- przywrócenie z kosza tylko przez właścicielkę. Dotyczy wyłącznie roli authenticated.
create function public.appointments_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.staff_id is distinct from old.staff_id then
    if not public.is_owner() then
      raise exception 'Termin innej osobie przypisuje tylko właścicielka' using errcode = '42501';
    end if;
    if not public.is_salon_member(new.staff_id) then
      raise exception 'Tej osoby nie ma w zespole' using errcode = '42501';
    end if;
  end if;

  if old.deleted_at is not null and new.deleted_at is null and not public.is_owner() then
    raise exception 'Z kosza przywraca tylko właścicielka' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger appointments_guard_update
before update on public.appointments
for each row execute function public.appointments_guard_update();

create trigger appointments_audit after update on public.appointments
for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Uprawnienia + RLS. salon_id i created_by wyłącznie z wartości domyślnych.
-- ---------------------------------------------------------------------------

alter table public.appointments enable row level security;

revoke all on public.appointments from anon, authenticated;

grant select on public.appointments to authenticated;
grant insert (id, staff_id, client_id, service_id, starts_at, duration_min, note, status) on public.appointments to authenticated;
grant update (staff_id, client_id, service_id, starts_at, duration_min, note, status, visit_id, deleted_at)
  on public.appointments to authenticated;

create policy appointments_select on public.appointments
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and deleted_at is null
    and visit_id is null
    and (staff_id = (select auth.uid()) or public.is_owner())
    and public.is_salon_member(staff_id)
  );

create policy appointments_update on public.appointments
  for update to authenticated
  using (salon_id = public.current_salon_id() and (staff_id = (select auth.uid()) or public.is_owner()))
  with check (salon_id = public.current_salon_id() and (staff_id = (select auth.uid()) or public.is_owner()));

-- Brak polityki DELETE – tylko miękkie usuwanie.

-- ---------------------------------------------------------------------------
-- Alergie „nieuzupełnione”: receptury (farby) nie da się zapisać, dopóki nie wybrano
-- „Brak znanych alergii” albo „Są alergie”. Termin i wizyta bez receptury – bez ograniczeń.
-- ---------------------------------------------------------------------------

create function public.mix_items_require_allergy_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if exists (
    select 1
    from public.recipe_mixes m
    join public.recipes r on r.id = m.recipe_id
    join public.visits v on v.id = r.visit_id
    join public.clients c on c.id = v.client_id
    where m.id = new.mix_id
      and c.allergy_status = 'unknown'
  ) then
    raise exception 'Zapytaj o alergie przed nałożeniem farby' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger mix_items_require_allergy_status
before insert on public.mix_items
for each row execute function public.mix_items_require_allergy_status();

-- ---------------------------------------------------------------------------
-- restore_version – nowa wersja: przywraca też wersje terminów.
-- ---------------------------------------------------------------------------

create or replace function public.restore_version(p_audit_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry public.audit_log%rowtype;
  v_row jsonb;
  v_count int;
begin
  if not public.is_owner() then
    raise exception 'Wersję przywraca tylko właścicielka' using errcode = '42501';
  end if;

  select * into v_entry from public.audit_log where id = p_audit_id;
  if v_entry.id is null then
    raise exception 'Nie znaleziono wersji' using errcode = 'P0002';
  end if;
  v_row := v_entry.old_row;

  if v_entry.table_name = 'clients' then
    update public.clients set
      full_name = v_row ->> 'full_name',
      phone = v_row ->> 'phone',
      allergy_status = (v_row ->> 'allergy_status')::public.allergy_status,
      allergies = v_row ->> 'allergies',
      email = v_row ->> 'email',
      note = v_row ->> 'note',
      rodo_consent_at = (v_row ->> 'rodo_consent_at')::timestamptz,
      notifications_consent_at = (v_row ->> 'notifications_consent_at')::timestamptz,
      photo_consent_at = (v_row ->> 'photo_consent_at')::timestamptz
    where id = v_entry.row_id and deleted_at is null;
  elsif v_entry.table_name = 'visits' then
    update public.visits set
      service_id = (v_row ->> 'service_id')::uuid,
      visit_at = (v_row ->> 'visit_at')::timestamptz,
      price = (v_row ->> 'price')::numeric
    where id = v_entry.row_id and deleted_at is null;
  elsif v_entry.table_name = 'appointments' then
    update public.appointments set
      staff_id = (v_row ->> 'staff_id')::uuid,
      client_id = (v_row ->> 'client_id')::uuid,
      service_id = (v_row ->> 'service_id')::uuid,
      starts_at = (v_row ->> 'starts_at')::timestamptz,
      duration_min = (v_row ->> 'duration_min')::integer,
      note = v_row ->> 'note',
      status = (v_row ->> 'status')::public.appointment_status
    where id = v_entry.row_id and deleted_at is null;
  elsif v_entry.table_name = 'visit_recipe' and v_entry.action = 'recipe_snapshot' then
    perform public.save_recipe(v_entry.row_id, v_row);
    return;
  else
    raise exception 'Tej wersji nie można przywrócić' using errcode = '22023';
  end if;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Wiersz usunięty – najpierw przywróć go z kosza' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.restore_version(bigint) is 'Przywrócenie wersji klientki, wizyty, terminu lub receptury z historii (tylko właścicielka).';
