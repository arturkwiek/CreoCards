-- Etap 4: wizyty i receptury
-- Tabele: services (lista usług), visits, recipes (1 na wizytę), recipe_mixes (mieszanki), mix_items (farby w mieszance).
-- Funkcje: save_recipe (zapis receptury w jednej transakcji), import_services (import CSV usług),
-- product_usage (ranking „najczęściej używane”).
-- RLS: zespół salonu czyta; wizytę dodaje każda aktywna osoba; edytuje autorka lub właścicielka;
-- miękko usuwa wizytę tylko właścicielka. Usługi zmienia tylko właścicielka.
-- Migracja addytywna. Brak polityk DELETE.

create type public.mix_zone as enum ('calosc', 'odrost', 'dlugosci', 'konce', 'pasemka', 'inne');

comment on type public.mix_zone is 'Strefa mieszanki: całość, odrost, długości, końce, pasemka, inne';

-- Cel złożonych kluczy obcych (wizyta zawsze dla klientki tego samego salonu).
alter table public.clients add constraint clients_id_salon_id_key unique (id, salon_id);

-- ---------------------------------------------------------------------------
-- services – lista usług salonu
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  name text not null check (length(btrim(name)) between 1 and 120),
  price_from numeric(10, 2) check (price_from is null or (price_from >= 0 and price_from <= 100000)),
  price_to numeric(10, 2) check (price_to is null or (price_to >= 0 and price_to <= 100000)),
  duration_min integer check (duration_min is null or duration_min between 1 and 1440),
  with_color boolean not null default false,
  position integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, salon_id),
  check (price_from is null or price_to is null or price_to >= price_from)
);

comment on table public.services is 'Usługi salonu (lista wyboru przy wizycie). with_color = usługa z farbą (otwiera recepturę).';

create unique index services_salon_name_uidx
  on public.services (salon_id, lower(btrim(name)))
  where deleted_at is null;

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- visits – wizyta klientki (autorka = osoba wykonująca)
-- ---------------------------------------------------------------------------

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  client_id uuid not null,
  service_id uuid,
  -- Edytowalna, także wstecz (przenoszenie receptur z zeszytu).
  visit_at timestamptz not null default now() check (visit_at >= '2000-01-01'),
  price numeric(10, 2) check (price is null or (price >= 0 and price <= 100000)),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, salon_id),
  foreign key (client_id, salon_id) references public.clients (id, salon_id),
  foreign key (service_id, salon_id) references public.services (id, salon_id)
);

comment on table public.visits is 'Wizyty. created_by = osoba wykonująca (zapisywana automatycznie).';
comment on column public.visits.price is 'Cena usługi (opcjonalna) – pod przyszłe finanse.';

create index visits_client_idx on public.visits (salon_id, client_id, visit_at desc) where deleted_at is null;

create trigger visits_set_updated_at
before update on public.visits
for each row execute function public.set_updated_at();

-- Miękkie usuwanie (i przywracanie) wizyty tylko przez właścicielkę.
create function public.visits_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at and not public.is_owner() then
    raise exception 'Tylko właścicielka może usuwać wizyty'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger visits_guard_update
before update on public.visits
for each row execute function public.visits_guard_update();

-- ---------------------------------------------------------------------------
-- recipes, recipe_mixes, mix_items – receptura koloryzacji
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  visit_id uuid not null,
  note text not null default '' check (length(note) <= 500),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, salon_id),
  foreign key (visit_id, salon_id) references public.visits (id, salon_id)
);

comment on table public.recipes is 'Receptura koloryzacji – należy do wizyty (najwyżej jedna aktywna na wizytę).';

create unique index recipes_visit_uidx on public.recipes (visit_id) where deleted_at is null;

create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

create table public.recipe_mixes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  recipe_id uuid not null,
  position smallint not null default 0 check (position between 0 and 100),
  zone public.mix_zone not null default 'calosc',
  -- NULL = mieszanka bez utleniacza (wtedy brak proporcji i 0 g utleniacza).
  oxidant_percent numeric(4, 2) check (oxidant_percent is null or (oxidant_percent > 0 and oxidant_percent <= 20)),
  ratio numeric(4, 2) check (ratio is null or (ratio > 0 and ratio <= 10)),
  oxidant_grams numeric(7, 1) not null default 0 check (oxidant_grams >= 0 and oxidant_grams <= 10000),
  oxidant_product_id uuid,
  processing_minutes smallint check (processing_minutes is null or processing_minutes between 0 and 600),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, salon_id),
  foreign key (recipe_id, salon_id) references public.recipes (id, salon_id),
  foreign key (oxidant_product_id, salon_id) references public.products (id, salon_id),
  check (
    (oxidant_percent is null and ratio is null and oxidant_grams = 0 and oxidant_product_id is null)
    or (oxidant_percent is not null and ratio is not null)
  )
);

comment on table public.recipe_mixes is 'Mieszanka receptury: strefa, utleniacz (stężenie, proporcja, wyliczone gramy), czas trzymania.';
comment on column public.recipe_mixes.oxidant_product_id is 'Utleniacz z katalogu (ta sama marka, to samo stężenie) – pod odejmowanie ze stanu w Etapie 8.';

create index recipe_mixes_recipe_idx on public.recipe_mixes (recipe_id) where deleted_at is null;

create trigger recipe_mixes_set_updated_at
before update on public.recipe_mixes
for each row execute function public.set_updated_at();

create table public.mix_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  mix_id uuid not null,
  product_id uuid not null,
  grams numeric(7, 1) not null check (grams > 0 and grams <= 1000),
  position smallint not null default 0 check (position between 0 and 100),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (mix_id, salon_id) references public.recipe_mixes (id, salon_id),
  foreign key (product_id, salon_id) references public.products (id, salon_id)
);

comment on table public.mix_items is 'Farba (produkt z katalogu) i jej ilość w gramach w mieszance.';

create index mix_items_mix_idx on public.mix_items (mix_id) where deleted_at is null;
create index mix_items_product_idx on public.mix_items (salon_id, product_id) where deleted_at is null;

create trigger mix_items_set_updated_at
before update on public.mix_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funkcje pomocnicze RLS: czy zalogowana osoba może edytować wizytę / recepturę / mieszankę.
-- Autorka wizyty albo właścicielka; wizyta aktywna i w salonie osoby.
-- ---------------------------------------------------------------------------

create function public.can_edit_visit(p_visit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.visits v
    where v.id = p_visit_id
      and v.salon_id = public.current_salon_id()
      and v.deleted_at is null
      and (v.created_by = (select auth.uid()) or public.is_owner())
  );
$$;

create function public.can_edit_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipes r
    where r.id = p_recipe_id
      and r.deleted_at is null
      and public.can_edit_visit(r.visit_id)
  );
$$;

create function public.can_edit_mix(p_mix_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipe_mixes m
    where m.id = p_mix_id
      and m.deleted_at is null
      and public.can_edit_recipe(m.recipe_id)
  );
$$;

revoke execute on function public.can_edit_visit(uuid) from public, anon;
revoke execute on function public.can_edit_recipe(uuid) from public, anon;
revoke execute on function public.can_edit_mix(uuid) from public, anon;
grant execute on function public.can_edit_visit(uuid) to authenticated, service_role;
grant execute on function public.can_edit_recipe(uuid) to authenticated, service_role;
grant execute on function public.can_edit_mix(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Uprawnienia (najmniejsze potrzebne) + Row Level Security
-- salon_id i created_by pochodzą wyłącznie z wartości domyślnych (brak grantu na te kolumny).
-- ---------------------------------------------------------------------------

alter table public.services enable row level security;
alter table public.visits enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_mixes enable row level security;
alter table public.mix_items enable row level security;

revoke all on public.services from anon, authenticated;
revoke all on public.visits from anon, authenticated;
revoke all on public.recipes from anon, authenticated;
revoke all on public.recipe_mixes from anon, authenticated;
revoke all on public.mix_items from anon, authenticated;

grant select on public.services to authenticated;
grant insert (name, price_from, price_to, duration_min, with_color, position) on public.services to authenticated;
grant update (name, price_from, price_to, duration_min, with_color, position, deleted_at) on public.services to authenticated;

grant select on public.visits to authenticated;
grant insert (client_id, service_id, visit_at, price) on public.visits to authenticated;
grant update (service_id, visit_at, price, deleted_at) on public.visits to authenticated;

grant select on public.recipes to authenticated;
grant insert (visit_id, note) on public.recipes to authenticated;
grant update (note, deleted_at) on public.recipes to authenticated;

grant select on public.recipe_mixes to authenticated;
grant insert (recipe_id, position, zone, oxidant_percent, ratio, oxidant_grams, oxidant_product_id, processing_minutes)
  on public.recipe_mixes to authenticated;
grant update (deleted_at) on public.recipe_mixes to authenticated;

grant select on public.mix_items to authenticated;
grant insert (mix_id, product_id, grams, position) on public.mix_items to authenticated;
grant update (deleted_at) on public.mix_items to authenticated;

-- services: czyta zespół, zmienia właścicielka.
create policy services_select on public.services
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy services_insert on public.services
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and public.is_owner()
    and created_by = (select auth.uid())
    and deleted_at is null
  );

create policy services_update on public.services
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.is_owner())
  with check (salon_id = public.current_salon_id());

-- visits: czyta zespół, dodaje każda aktywna osoba, edytuje autorka lub właścicielka.
create policy visits_select on public.visits
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy visits_insert on public.visits
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and deleted_at is null
  );

create policy visits_update on public.visits
  for update to authenticated
  using (salon_id = public.current_salon_id() and (created_by = (select auth.uid()) or public.is_owner()))
  with check (salon_id = public.current_salon_id());

-- recipes / recipe_mixes / mix_items: czyta zespół, zapisuje osoba, która może edytować wizytę.
create policy recipes_select on public.recipes
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy recipes_insert on public.recipes
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and deleted_at is null
    and public.can_edit_visit(visit_id)
  );

create policy recipes_update on public.recipes
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.can_edit_visit(visit_id))
  with check (salon_id = public.current_salon_id());

create policy recipe_mixes_select on public.recipe_mixes
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy recipe_mixes_insert on public.recipe_mixes
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and deleted_at is null
    and public.can_edit_recipe(recipe_id)
  );

create policy recipe_mixes_update on public.recipe_mixes
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.can_edit_recipe(recipe_id))
  with check (salon_id = public.current_salon_id());

create policy mix_items_select on public.mix_items
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy mix_items_insert on public.mix_items
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and deleted_at is null
    and public.can_edit_mix(mix_id)
  );

create policy mix_items_update on public.mix_items
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.can_edit_mix(mix_id))
  with check (salon_id = public.current_salon_id());

-- ---------------------------------------------------------------------------
-- save_recipe – zapis receptury wizyty w jednej transakcji (SECURITY INVOKER: RLS osoby wywołującej).
-- p_recipe: {note, mixes: [{zone, oxidant_percent, ratio, oxidant_product_id, processing_minutes,
--            items: [{product_id, grams}]}]}. Gramy utleniacza liczy baza: suma gramów farb × proporcja.
-- Poprzednie mieszanki i pozycje są miękko usuwane. Brak mieszanek i notatki = receptura usunięta (miękko).
-- Zwraca id receptury albo NULL.
-- ---------------------------------------------------------------------------

create function public.save_recipe(p_visit_id uuid, p_recipe jsonb)
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

  -- Poprzednia zawartość – miękko usuwana (nigdy DELETE).
  if v_recipe_id is not null then
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

comment on function public.save_recipe(uuid, jsonb) is 'Zapis receptury wizyty w jednej transakcji (autorka wizyty lub właścicielka).';

revoke execute on function public.save_recipe(uuid, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- import_services – import CSV usług (tylko właścicielka), wszystko albo nic.
-- Element: {name, price_from?, price_to?, duration_min?, with_color?}. Brak klucza / null = bez zmian.
-- ---------------------------------------------------------------------------

create function public.import_services(items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  v_salon uuid := public.current_salon_id();
  v_service public.services%rowtype;
  v_name text;
  v_from numeric;
  v_to numeric;
  v_duration int;
  v_color boolean;
  v_position int;
  created int := 0;
  updated int := 0;
begin
  if v_salon is null or not public.is_owner() then
    raise exception 'Import usług może wykonać tylko właścicielka' using errcode = '42501';
  end if;

  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) > 1000 then
    raise exception 'Nieprawidłowe dane importu' using errcode = '22023';
  end if;

  select coalesce(max(position), -1) into v_position
  from public.services where salon_id = v_salon and deleted_at is null;

  for item in select value from jsonb_array_elements(items) loop
    v_name := btrim(item ->> 'name');
    v_from := (item ->> 'price_from')::numeric;
    v_to := (item ->> 'price_to')::numeric;
    v_duration := (item ->> 'duration_min')::int;
    v_color := (item ->> 'with_color')::boolean;

    if v_name is null or v_name = '' then
      raise exception 'Brak nazwy usługi' using errcode = '22023';
    end if;

    select * into v_service
    from public.services s
    where s.salon_id = v_salon and s.deleted_at is null and lower(btrim(s.name)) = lower(v_name);

    if v_service.id is null then
      v_position := v_position + 1;
      insert into public.services (name, price_from, price_to, duration_min, with_color, position)
      values (v_name, v_from, v_to, v_duration, coalesce(v_color, false), v_position);
      created := created + 1;
    else
      v_from := coalesce(v_from, v_service.price_from);
      v_to := coalesce(v_to, v_service.price_to);
      v_duration := coalesce(v_duration, v_service.duration_min);
      v_color := coalesce(v_color, v_service.with_color);
      if (v_service.price_from, v_service.price_to, v_service.duration_min, v_service.with_color)
         is distinct from (v_from, v_to, v_duration, v_color) then
        update public.services
        set price_from = v_from, price_to = v_to, duration_min = v_duration, with_color = v_color
        where id = v_service.id;
        updated := updated + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('created', created, 'updated', updated);
end;
$$;

comment on function public.import_services(jsonb) is 'Import usług w jednej transakcji (tylko właścicielka). Zwraca liczniki.';

revoke execute on function public.import_services(jsonb) from public, anon;
grant execute on function public.import_services(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- product_usage – ile razy produkt użyto w aktywnych recepturach salonu („najczęściej używane na górze”).
-- ---------------------------------------------------------------------------

create function public.product_usage()
returns table (product_id uuid, uses bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.product_id, count(*)::bigint
  from public.mix_items i
  where i.deleted_at is null and i.salon_id = public.current_salon_id()
  group by i.product_id;
$$;

revoke execute on function public.product_usage() from public, anon;
grant execute on function public.product_usage() to authenticated;
