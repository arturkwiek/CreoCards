-- Etap 4a: bezpieczeństwo danych
-- audit_log: poprzednia wersja wiersza, kto, kiedy – dla clients, visits, recipes, recipe_mixes, mix_items, products;
-- migawka całej receptury przed każdą zmianą (save_recipe); log eksportów danych.
-- restore_version: przywrócenie wersji (tylko właścicielka). Kosz korzysta z istniejącego deleted_at.
-- Migracja addytywna (nowe typy, tabela, funkcje, triggery; nowa wersja save_recipe).
--
-- Wyjątek od reguły kolumn audytu (AGENTS.md, pkt 4): audit_log jest dziennikiem tylko do dopisywania –
-- nie ma updated_at ani deleted_at, bo wpisów nie zmienia się ani nie usuwa (brak grantów).
-- Dane wrażliwe (alergie) trafiają do historii – widzi ją wyłącznie właścicielka.

create type public.audit_action as enum ('update', 'delete', 'restore', 'recipe_snapshot', 'export');

comment on type public.audit_action is 'update = zmiana, delete = miękkie usunięcie, restore = przywrócenie z kosza, recipe_snapshot = receptura przed zmianą, export = eksport danych';

create table public.audit_log (
  id bigint generated always as identity primary key,
  salon_id uuid not null references public.salons (id),
  -- Tabela źródłowa; dla migawki receptury 'visit_recipe' (row_id = id wizyty), dla eksportu 'export'.
  table_name text not null,
  row_id uuid,
  action public.audit_action not null,
  -- Wersja sprzed zmiany (dla eksportu: opis zakresu).
  old_row jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

comment on table public.audit_log is 'Historia zmian (poprzednia wersja wiersza, kto, kiedy) i log eksportów. Tylko do dopisywania; czyta wyłącznie właścicielka.';

create index audit_log_row_idx on public.audit_log (salon_id, table_name, row_id, created_at desc);
create index audit_log_time_idx on public.audit_log (salon_id, created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated;
grant select on public.audit_log to authenticated;

create policy audit_log_select_owner on public.audit_log
  for select to authenticated
  using (salon_id = public.current_salon_id() and public.is_owner());

-- ---------------------------------------------------------------------------
-- Trigger: poprzednia wersja wiersza przy każdej zmianie (także zmiany kluczem service_role).
-- SECURITY DEFINER – wpis powstaje bez grantów na audit_log dla użytkowników.
-- ---------------------------------------------------------------------------

create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action public.audit_action;
begin
  -- Sama zmiana updated_at (np. ponowny zapis bez zmian) nie tworzy wersji.
  if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return new;
  end if;

  v_action := case
    when old.deleted_at is null and new.deleted_at is not null then 'delete'
    when old.deleted_at is not null and new.deleted_at is null then 'restore'
    else 'update'
  end;

  insert into public.audit_log (salon_id, table_name, row_id, action, old_row, created_by)
  values (old.salon_id, tg_table_name, old.id, v_action, to_jsonb(old), (select auth.uid()));

  return new;
end;
$$;

revoke execute on function public.audit_row_change() from public, anon, authenticated;

create trigger clients_audit after update on public.clients
for each row execute function public.audit_row_change();
create trigger visits_audit after update on public.visits
for each row execute function public.audit_row_change();
create trigger recipes_audit after update on public.recipes
for each row execute function public.audit_row_change();
create trigger recipe_mixes_audit after update on public.recipe_mixes
for each row execute function public.audit_row_change();
create trigger mix_items_audit after update on public.mix_items
for each row execute function public.audit_row_change();
create trigger products_audit after update on public.products
for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Migawka całej receptury wizyty (format jak wejście save_recipe) – przed każdą zmianą.
-- ---------------------------------------------------------------------------

create function public.recipe_snapshot(p_visit_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'note', r.note,
    'mixes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'zone', m.zone,
          'oxidant_percent', m.oxidant_percent,
          'ratio', m.ratio,
          'oxidant_product_id', m.oxidant_product_id,
          'processing_minutes', m.processing_minutes,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object('product_id', i.product_id, 'grams', i.grams) order by i.position)
            from public.mix_items i
            where i.mix_id = m.id and i.deleted_at is null
          ), '[]'::jsonb)
        ) order by m.position)
      from public.recipe_mixes m
      where m.recipe_id = r.id and m.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.recipes r
  where r.visit_id = p_visit_id and r.deleted_at is null;
$$;

revoke execute on function public.recipe_snapshot(uuid) from public, anon;
grant execute on function public.recipe_snapshot(uuid) to authenticated;

-- Zapis migawki: tylko osoba, która może edytować wizytę (wywoływane z save_recipe).
create function public.audit_recipe_snapshot(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_salon uuid;
begin
  if not public.can_edit_visit(p_visit_id) then
    raise exception 'Brak uprawnień do edycji tej wizyty' using errcode = '42501';
  end if;

  v_snapshot := public.recipe_snapshot(p_visit_id);
  if v_snapshot is null then
    return;
  end if;

  select salon_id into v_salon from public.visits where id = p_visit_id;
  insert into public.audit_log (salon_id, table_name, row_id, action, old_row, created_by)
  values (v_salon, 'visit_recipe', p_visit_id, 'recipe_snapshot', v_snapshot, (select auth.uid()));
end;
$$;

revoke execute on function public.audit_recipe_snapshot(uuid) from public, anon;
grant execute on function public.audit_recipe_snapshot(uuid) to authenticated;

-- Nowa wersja save_recipe: przed zmianą zapisuje migawkę poprzedniej receptury.
create or replace function public.save_recipe(p_visit_id uuid, p_recipe jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_recipe_id uuid;
  v_mix jsonb;
  v_mix_pos int;
  v_mix_id uuid;
  v_item jsonb;
  v_item_pos int;
  v_note text := btrim(coalesce(p_recipe ->> 'note', ''));
  v_mixes jsonb := coalesce(p_recipe -> 'mixes', '[]'::jsonb);
  v_percent numeric;
  v_ratio numeric;
  v_total numeric;
begin
  if not public.can_edit_visit(p_visit_id) then
    raise exception 'Brak uprawnień do edycji tej wizyty' using errcode = '42501';
  end if;

  if jsonb_typeof(v_mixes) is distinct from 'array' or jsonb_array_length(v_mixes) > 20 then
    raise exception 'Nieprawidłowa receptura' using errcode = '22023';
  end if;

  select id into v_recipe_id
  from public.recipes
  where visit_id = p_visit_id and deleted_at is null;

  if v_recipe_id is not null then
    -- Historia: cała receptura sprzed zmiany (do przywrócenia przez właścicielkę).
    perform public.audit_recipe_snapshot(p_visit_id);

    -- Poprzednia zawartość – miękko usuwana (nigdy DELETE).
    update public.mix_items i set deleted_at = now()
    from public.recipe_mixes m
    where i.mix_id = m.id and m.recipe_id = v_recipe_id and i.deleted_at is null and m.deleted_at is null;
    update public.recipe_mixes set deleted_at = now() where recipe_id = v_recipe_id and deleted_at is null;
  end if;

  if jsonb_array_length(v_mixes) = 0 and v_note = '' then
    if v_recipe_id is not null then
      update public.recipes set deleted_at = now() where id = v_recipe_id;
    end if;
    return null;
  end if;

  if v_recipe_id is null then
    insert into public.recipes (visit_id, note) values (p_visit_id, v_note) returning id into v_recipe_id;
  else
    update public.recipes set note = v_note where id = v_recipe_id;
  end if;

  for v_mix, v_mix_pos in select value, ordinality - 1 from jsonb_array_elements(v_mixes) with ordinality loop
    if jsonb_typeof(v_mix -> 'items') is distinct from 'array' or jsonb_array_length(v_mix -> 'items') > 20 then
      raise exception 'Nieprawidłowa mieszanka' using errcode = '22023';
    end if;

    v_percent := (v_mix ->> 'oxidant_percent')::numeric;
    v_ratio := case when v_percent is null then null else (v_mix ->> 'ratio')::numeric end;
    select coalesce(sum((i ->> 'grams')::numeric), 0) into v_total from jsonb_array_elements(v_mix -> 'items') i;

    insert into public.recipe_mixes (
      recipe_id, position, zone, oxidant_percent, ratio, oxidant_grams, oxidant_product_id, processing_minutes
    ) values (
      v_recipe_id,
      v_mix_pos,
      coalesce((v_mix ->> 'zone')::public.mix_zone, 'calosc'),
      v_percent,
      v_ratio,
      case when v_percent is null then 0 else round(v_total * v_ratio, 1) end,
      case when v_percent is null then null else (v_mix ->> 'oxidant_product_id')::uuid end,
      (v_mix ->> 'processing_minutes')::smallint
    ) returning id into v_mix_id;

    for v_item, v_item_pos in select value, ordinality - 1 from jsonb_array_elements(v_mix -> 'items') with ordinality loop
      insert into public.mix_items (mix_id, product_id, grams, position)
      values (v_mix_id, (v_item ->> 'product_id')::uuid, (v_item ->> 'grams')::numeric, v_item_pos);
    end loop;
  end loop;

  return v_recipe_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- restore_version – przywrócenie wersji z historii (tylko właścicielka).
-- SECURITY INVOKER: obowiązują RLS i triggery; samo przywrócenie też trafia do historii.
-- Klientka i wizyta: pola formularza (bez deleted_at – od tego jest Kosz). Receptura: migawka przez save_recipe.
-- ---------------------------------------------------------------------------

create function public.restore_version(p_audit_id bigint)
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
      notifications_consent_at = (v_row ->> 'notifications_consent_at')::timestamptz
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

comment on function public.restore_version(bigint) is 'Przywrócenie wersji klientki, wizyty lub receptury z historii (tylko właścicielka).';

revoke execute on function public.restore_version(bigint) from public, anon;
grant execute on function public.restore_version(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- log_export – zapis eksportu danych (kto i co pobrał), tylko właścicielka.
-- ---------------------------------------------------------------------------

create function public.log_export(p_scope text, p_row_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Eksport danych tylko dla właścicielki' using errcode = '42501';
  end if;
  if p_scope not in ('all', 'client') then
    raise exception 'Nieznany zakres eksportu' using errcode = '22023';
  end if;
  insert into public.audit_log (salon_id, table_name, row_id, action, old_row, created_by)
  values (public.current_salon_id(), 'export', p_row_id, 'export', jsonb_build_object('scope', p_scope), (select auth.uid()));
end;
$$;

revoke execute on function public.log_export(text, uuid) from public, anon;
grant execute on function public.log_export(text, uuid) to authenticated;
