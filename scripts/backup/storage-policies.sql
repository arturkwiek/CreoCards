-- Polityki RLS na tabelach schematu storage (np. dostęp do zdjęć) jako SQL do odtworzenia.
-- Zrzut schematu Supabase CLI pomija schemat storage, więc bez tego pliku przywrócony projekt nie miałby polityk Storage.
-- Wynik: blok DO na każdą politykę – tworzy ją tylko wtedy, gdy jej nie ma (bezpieczne przy powtórzeniu).
select format(
  $f$do $do$ begin if not exists (select 1 from pg_policies where schemaname = %L and tablename = %L and policyname = %L) then execute %L; end if; end $do$;$f$,
  p.schemaname, p.tablename, p.policyname,
  format('create policy %I on %I.%I as %s for %s to %s%s%s',
    p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
    (select string_agg(quote_ident(r), ', ') from unnest(p.roles) as r),
    case when p.qual is not null then ' using (' || p.qual || ')' else '' end,
    case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end)
)
from pg_policies p
where p.schemaname = 'storage'
order by p.tablename, p.policyname;
