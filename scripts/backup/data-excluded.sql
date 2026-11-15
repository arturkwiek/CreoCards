-- Tabele do pominięcia w zrzucie danych: wszystko spoza public, czego nie ma na liście dozwolonych
-- (zmienna psql :allow – lista "schemat.tabela" rozdzielona przecinkami).
select n.nspname || '.' || c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname not in ('public', 'pg_catalog', 'information_schema', 'pg_toast')
  and n.nspname not like 'pg_temp%'
  and n.nspname || '.' || c.relname <> all (string_to_array(:'allow', ','))
order by 1;
