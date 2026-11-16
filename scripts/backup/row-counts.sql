-- Liczby wierszy (bez danych osobowych) – zapisywane w kopii i porównywane po przywróceniu (docs/PRZYWRACANIE.md).
select 'auth.users', count(*) from auth.users
union all select 'public.salons', count(*) from public.salons
union all select 'public.users', count(*) from public.users
union all select 'public.invitations', count(*) from public.invitations
union all select 'public.clients', count(*) from public.clients
union all select 'public.visits', count(*) from public.visits
union all select 'public.recipes', count(*) from public.recipes
union all select 'public.recipe_mixes', count(*) from public.recipe_mixes
union all select 'public.mix_items', count(*) from public.mix_items
union all select 'public.products', count(*) from public.products
union all select 'public.product_lines', count(*) from public.product_lines
union all select 'public.services', count(*) from public.services
union all select 'public.product_requests', count(*) from public.product_requests
union all select 'public.audit_log', count(*) from public.audit_log
union all select 'public.attachments', (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.attachments', false, true, '')))[1]::text::bigint
  where to_regclass('public.attachments') is not null
union all select 'storage.objects', (xpath('/row/c/text()', query_to_xml('select count(*) as c from storage.objects', false, true, '')))[1]::text::bigint
  where to_regclass('storage.objects') is not null
order by 1;
