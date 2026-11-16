-- Etap 5: Zdjęcia
-- clients.photo_consent_at – zgoda na wizerunek (data). Zdjęcia bez twarzy dozwolone zawsze.
-- attachments – zdjęcia wizyt (w Etapie 6 także notatki głosowe); pliki w prywatnym buckecie „photos”.
-- Ścieżka pliku: <salon_id>/<visit_id>/<attachment_id>.<webp|jpg>, miniatura: …/<attachment_id>-m.<webp|jpg>.
-- Usuwanie miękkie (Kosz): przenosi osoba, która może edytować wizytę; przywraca tylko właścicielka.
-- Plików nie da się nadpisać ani usunąć z konta użytkownika (przywracanie z Kosza zawsze działa).
-- Migracja addytywna (nowa kolumna, typ, tabela, bucket, polityki; nowa wersja restore_version).

-- ---------------------------------------------------------------------------
-- Zgoda na wizerunek
-- ---------------------------------------------------------------------------

alter table public.clients add column photo_consent_at timestamptz;

comment on column public.clients.photo_consent_at is 'Zgoda na zdjęcia z wizerunkiem (data). Brak = tylko zdjęcia bez twarzy bez ostrzeżenia.';

grant insert (photo_consent_at) on public.clients to authenticated;
grant update (photo_consent_at) on public.clients to authenticated;

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------

create type public.attachment_kind as enum ('photo');

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  visit_id uuid not null,
  -- Ustawiana triggerem z wizyty (oś czasu klientki, lista „Zdjęcia bez zgody”).
  client_id uuid not null,
  kind public.attachment_kind not null default 'photo',
  storage_path text not null unique,
  thumb_path text not null unique,
  mime text not null check (mime in ('image/webp', 'image/jpeg')),
  width int not null check (width between 1 and 4000),
  height int not null check (height between 1 and 4000),
  size_bytes int not null check (size_bytes between 1 and 5242880),
  -- Czy na zdjęciu może być twarz (false = np. tył głowy – dozwolone zawsze).
  shows_face boolean not null default true,
  -- Zdjęcie z twarzą dodane, gdy klientka nie miała zgody (ustawiane triggerem, po ostrzeżeniu).
  consent_missing boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, salon_id),
  foreign key (visit_id, salon_id) references public.visits (id, salon_id),
  foreign key (client_id, salon_id) references public.clients (id, salon_id),
  check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
    and storage_path = salon_id::text || '/' || visit_id::text || '/' || id::text
      || case mime when 'image/webp' then '.webp' else '.jpg' end
  ),
  check (
    thumb_path = salon_id::text || '/' || visit_id::text || '/' || id::text || '-m'
      || case mime when 'image/webp' then '.webp' else '.jpg' end
  )
);

comment on table public.attachments is 'Zdjęcia wizyt (plik w buckecie photos, w bazie tylko ścieżka). Usuwanie miękkie.';

create index attachments_visit_idx on public.attachments (salon_id, visit_id, created_at) where deleted_at is null;
create index attachments_client_idx on public.attachments (salon_id, client_id, created_at desc) where deleted_at is null;

create trigger attachments_set_updated_at
before update on public.attachments
for each row execute function public.set_updated_at();

-- Klientka z wizyty + znacznik braku zgody (nie od klienta aplikacji).
create function public.attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_consent timestamptz;
begin
  select v.client_id, c.photo_consent_at into v_client, v_consent
  from public.visits v
  join public.clients c on c.id = v.client_id
  where v.id = new.visit_id and v.salon_id = new.salon_id;

  if v_client is null then
    raise exception 'Nie znaleziono wizyty' using errcode = '23503';
  end if;

  new.client_id := v_client;
  new.consent_missing := new.shows_face and v_consent is null;
  return new;
end;
$$;

revoke execute on function public.attachments_before_insert() from public, anon, authenticated;

create trigger attachments_before_insert
before insert on public.attachments
for each row execute function public.attachments_before_insert();

-- Przywracanie z Kosza tylko przez właścicielkę.
create function public.attachments_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if old.deleted_at is not null and new.deleted_at is null and not public.is_owner() then
    raise exception 'Zdjęcie z kosza przywraca tylko właścicielka' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger attachments_guard_update
before update on public.attachments
for each row execute function public.attachments_guard_update();

create trigger attachments_audit after update on public.attachments
for each row execute function public.audit_row_change();

alter table public.attachments enable row level security;
revoke all on public.attachments from anon, authenticated;

grant select on public.attachments to authenticated;
grant insert (id, visit_id, kind, storage_path, thumb_path, mime, width, height, size_bytes, shows_face)
  on public.attachments to authenticated;
grant update (deleted_at) on public.attachments to authenticated;

-- Czyta zespół salonu.
create policy attachments_select on public.attachments
  for select to authenticated
  using (salon_id = public.current_salon_id());

-- Dodaje osoba, która może edytować wizytę (autorka lub właścicielka).
create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and deleted_at is null
    and public.can_edit_visit(visit_id)
  );

-- Do kosza: osoba, która może edytować wizytę, albo właścicielka (także przy wizycie w koszu).
create policy attachments_update on public.attachments
  for update to authenticated
  using (salon_id = public.current_salon_id() and (public.can_edit_visit(visit_id) or public.is_owner()))
  with check (salon_id = public.current_salon_id());

-- ---------------------------------------------------------------------------
-- Storage: prywatny bucket „photos” + polityki (izolacja salonów po pierwszym katalogu ścieżki)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Wysłanie pliku: <salon użytkownika>/<wizyta, którą może edytować>/<uuid>[-m].<webp|jpg>.
create function public.can_upload_photo(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-m)?\.(webp|jpg)$' then
    return false;
  end if;
  v_parts := string_to_array(p_name, '/');
  return v_parts[1] = public.current_salon_id()::text
    and public.can_edit_visit(v_parts[2]::uuid);
end;
$$;

-- Odczyt (podpisane linki): plik zapisanego zdjęcia z własnego salonu; z kosza – tylko właścicielka.
create function public.can_read_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attachments a
    where (a.storage_path = p_name or a.thumb_path = p_name)
      and a.salon_id = public.current_salon_id()
      and (a.deleted_at is null or public.is_owner())
  );
$$;

revoke execute on function public.can_upload_photo(text) from public, anon;
revoke execute on function public.can_read_photo(text) from public, anon;
grant execute on function public.can_upload_photo(text) to authenticated;
grant execute on function public.can_read_photo(text) to authenticated;

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.can_upload_photo(name));

create policy photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.can_read_photo(name));

-- Brak polityk UPDATE i DELETE dla bucketu photos: plików nie da się nadpisać ani usunąć z konta użytkownika.

-- ---------------------------------------------------------------------------
-- restore_version – nowa wersja: przywraca też zgodę na zdjęcia klientki
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
