-- Etap 3: katalog preparatów
-- Tabele: product_lines (marka + linia z domyślną proporcją utleniacza), products (odcienie / stężenia),
-- product_requests („Zgłoś brak”). Funkcja import_products – import CSV w jednej transakcji.
-- RLS: cały zespół salonu czyta katalog; dodaje, edytuje i miękko usuwa wyłącznie właścicielka.
-- Zgłoszenia: dodaje każda aktywna osoba, „załatwione” oznacza tylko właścicielka.
-- Migracja addytywna. Brak polityk DELETE. Katalog nie zawiera danych osobowych.

create type public.product_type as enum ('farba', 'utleniacz', 'rozjasniacz', 'toner', 'inny');

comment on type public.product_type is 'Rodzaj preparatu: farba, utleniacz, rozjaśniacz, toner, inny';

create type public.product_request_kind as enum ('missing', 'running_low');

comment on type public.product_request_kind is 'missing = brak w katalogu, running_low = kończy się';

-- ---------------------------------------------------------------------------
-- product_lines – marka i linia
-- ---------------------------------------------------------------------------

create table public.product_lines (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  brand text not null check (length(btrim(brand)) between 1 and 80),
  -- Pusta nazwa linii dopuszczalna (marka bez linii).
  name text not null default '' check (length(name) <= 80),
  -- Proporcja farba:utleniacz zapisana jako część utleniacza na 1 część farby (1:1,5 → 1.5).
  default_ratio numeric(4, 2) check (default_ratio is null or (default_ratio > 0 and default_ratio <= 10)),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Cel złożonego klucza obcego z products (produkt zawsze w linii tego samego salonu).
  unique (id, salon_id)
);

comment on table public.product_lines is 'Marki i linie preparatów salonu.';
comment on column public.product_lines.default_ratio is 'Domyślna proporcja utleniacza: części utleniacza na 1 część farby (1:1,5 = 1.5). NULL = brak.';

create unique index product_lines_salon_brand_name_uidx
  on public.product_lines (salon_id, lower(btrim(brand)), lower(btrim(name)))
  where deleted_at is null;

create trigger product_lines_set_updated_at
before update on public.product_lines
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products – odcień / stężenie w linii
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  line_id uuid not null,
  shade text not null check (length(btrim(shade)) between 1 and 40),
  -- Klucz porównania odcieni: „7,1”, „7/1” i „7.1” to ten sam odcień.
  shade_key text generated always as (translate(lower(regexp_replace(shade, '\s', '', 'g')), ',/', '..')) stored,
  type public.product_type not null,
  package_size numeric(9, 2) check (package_size is null or (package_size > 0 and package_size <= 100000)),
  purchase_price numeric(10, 2) check (purchase_price is null or (purchase_price >= 0 and purchase_price <= 100000)),
  -- Proporcja produktu nadpisująca domyślną proporcję linii. NULL = jak w linii.
  ratio numeric(4, 2) check (ratio is null or (ratio > 0 and ratio <= 10)),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, salon_id),
  foreign key (line_id, salon_id) references public.product_lines (id, salon_id)
);

comment on table public.products is 'Preparaty salonu (odcień farby, stężenie utleniacza itd.).';
comment on column public.products.package_size is 'Pojemność opakowania w g lub ml.';
comment on column public.products.purchase_price is 'Cena zakupu w zł. W aplikacji widoczna tylko dla właścicielki.';
comment on column public.products.ratio is 'Proporcja nadpisująca domyślną proporcję linii. NULL = jak w linii.';

create unique index products_line_shade_uidx
  on public.products (line_id, shade_key)
  where deleted_at is null;

create index products_salon_idx on public.products (salon_id) where deleted_at is null;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_requests – „Zgłoś brak”
-- ---------------------------------------------------------------------------

create table public.product_requests (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null default public.current_salon_id() references public.salons (id),
  kind public.product_request_kind not null,
  product_id uuid,
  description text not null default '' check (length(description) <= 500),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (product_id, salon_id) references public.products (id, salon_id),
  -- „Kończy się” dotyczy produktu z katalogu; „brak w katalogu” wymaga opisu.
  check (
    (kind = 'running_low' and product_id is not null)
    or (kind = 'missing' and length(btrim(description)) > 0)
  )
);

comment on table public.product_requests is 'Zgłoszenia „Zgłoś brak”: brak w katalogu lub kończący się preparat.';

create index product_requests_open_idx
  on public.product_requests (salon_id, created_at desc)
  where resolved_at is null and deleted_at is null;

create trigger product_requests_set_updated_at
before update on public.product_requests
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Uprawnienia (najmniejsze potrzebne) + Row Level Security
-- salon_id i created_by pochodzą wyłącznie z wartości domyślnych (brak grantu na te kolumny).
-- ---------------------------------------------------------------------------

alter table public.product_lines enable row level security;
alter table public.products enable row level security;
alter table public.product_requests enable row level security;

revoke all on public.product_lines from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_requests from anon, authenticated;

grant select on public.product_lines to authenticated;
grant insert (brand, name, default_ratio) on public.product_lines to authenticated;
grant update (brand, name, default_ratio, deleted_at) on public.product_lines to authenticated;

grant select on public.products to authenticated;
grant insert (line_id, shade, type, package_size, purchase_price, ratio) on public.products to authenticated;
grant update (line_id, shade, type, package_size, purchase_price, ratio, deleted_at) on public.products to authenticated;

grant select on public.product_requests to authenticated;
grant insert (kind, product_id, description) on public.product_requests to authenticated;
grant update (resolved_at, resolved_by, deleted_at) on public.product_requests to authenticated;

-- product_lines: czyta zespół, zmienia właścicielka.
create policy product_lines_select on public.product_lines
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy product_lines_insert on public.product_lines
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and public.is_owner()
    and created_by = (select auth.uid())
    and deleted_at is null
  );

create policy product_lines_update on public.product_lines
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.is_owner())
  with check (salon_id = public.current_salon_id());

-- products: czyta zespół, zmienia właścicielka.
create policy products_select on public.products
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy products_insert on public.products
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and public.is_owner()
    and created_by = (select auth.uid())
    and deleted_at is null
  );

create policy products_update on public.products
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.is_owner())
  with check (salon_id = public.current_salon_id());

-- product_requests: zgłasza każda aktywna osoba, załatwia właścicielka.
create policy product_requests_select on public.product_requests
  for select to authenticated
  using (salon_id = public.current_salon_id());

create policy product_requests_insert on public.product_requests
  for insert to authenticated
  with check (
    salon_id = public.current_salon_id()
    and created_by = (select auth.uid())
    and resolved_at is null
    and resolved_by is null
    and deleted_at is null
  );

create policy product_requests_update on public.product_requests
  for update to authenticated
  using (salon_id = public.current_salon_id() and public.is_owner())
  with check (
    salon_id = public.current_salon_id()
    and (resolved_by is null or resolved_by = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Import katalogu (CSV przetworzony w aplikacji) – wszystko albo nic.
-- SECURITY INVOKER: obowiązują granty i RLS osoby wywołującej.
-- Element tablicy: {brand, line, shade, type, package_size?, purchase_price?, line_ratio?, ratio?}
--   * puste / brak package_size, purchase_price, line_ratio – nie nadpisuje istniejącej wartości,
--   * klucz ratio obecny (także null) – ustawia proporcję produktu; brak klucza – bez zmian.
-- ---------------------------------------------------------------------------

create function public.import_products(items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  v_salon uuid := public.current_salon_id();
  v_line public.product_lines%rowtype;
  v_product public.products%rowtype;
  v_brand text;
  v_line_name text;
  v_shade text;
  v_type public.product_type;
  v_size numeric;
  v_price numeric;
  v_line_ratio numeric;
  v_ratio numeric;
  lines_created int := 0;
  lines_updated int := 0;
  products_created int := 0;
  products_updated int := 0;
begin
  if v_salon is null or not public.is_owner() then
    raise exception 'Import katalogu może wykonać tylko właścicielka' using errcode = '42501';
  end if;

  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) > 5000 then
    raise exception 'Nieprawidłowe dane importu' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(items) loop
    v_brand := btrim(item ->> 'brand');
    v_line_name := btrim(coalesce(item ->> 'line', ''));
    v_shade := btrim(item ->> 'shade');
    v_type := (item ->> 'type')::public.product_type;
    v_size := (item ->> 'package_size')::numeric;
    v_price := (item ->> 'purchase_price')::numeric;
    v_line_ratio := (item ->> 'line_ratio')::numeric;
    v_ratio := (item ->> 'ratio')::numeric;

    if v_brand is null or v_shade is null or v_type is null then
      raise exception 'Brak marki, odcienia lub typu' using errcode = '22023';
    end if;

    -- Linia: istniejąca (bez względu na wielkość liter) albo nowa.
    select * into v_line
    from public.product_lines l
    where l.salon_id = v_salon
      and l.deleted_at is null
      and lower(btrim(l.brand)) = lower(v_brand)
      and lower(btrim(l.name)) = lower(v_line_name);

    if v_line.id is null then
      insert into public.product_lines (brand, name, default_ratio)
      values (v_brand, v_line_name, v_line_ratio)
      returning * into v_line;
      lines_created := lines_created + 1;
    elsif v_line_ratio is not null and v_line.default_ratio is distinct from v_line_ratio then
      update public.product_lines set default_ratio = v_line_ratio where id = v_line.id;
      lines_updated := lines_updated + 1;
    end if;

    -- Produkt: istniejący odcień w linii albo nowy.
    select * into v_product
    from public.products p
    where p.line_id = v_line.id
      and p.deleted_at is null
      and p.shade_key = translate(lower(regexp_replace(v_shade, '\s', '', 'g')), ',/', '..');

    if v_product.id is null then
      insert into public.products (line_id, shade, type, package_size, purchase_price, ratio)
      values (v_line.id, v_shade, v_type, v_size, v_price, v_ratio);
      products_created := products_created + 1;
    else
      v_size := coalesce(v_size, v_product.package_size);
      v_price := coalesce(v_price, v_product.purchase_price);
      if not (item ? 'ratio') then
        v_ratio := v_product.ratio;
      end if;
      if (v_product.type, v_product.package_size, v_product.purchase_price, v_product.ratio)
         is distinct from (v_type, v_size, v_price, v_ratio) then
        update public.products
        set type = v_type, package_size = v_size, purchase_price = v_price, ratio = v_ratio
        where id = v_product.id;
        products_updated := products_updated + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'lines_created', lines_created,
    'lines_updated', lines_updated,
    'products_created', products_created,
    'products_updated', products_updated
  );
end;
$$;

comment on function public.import_products(jsonb) is 'Import katalogu w jednej transakcji (tylko właścicielka). Zwraca liczniki.';

revoke execute on function public.import_products(jsonb) from public, anon;
grant execute on function public.import_products(jsonb) to authenticated;
