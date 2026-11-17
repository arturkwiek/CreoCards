-- Strona „Kontynuuj” linku do ustawienia hasła: nazwa salonu, do którego należy konto z linku.
-- Tylko nazwa salonu (bez imienia, loginu i e-maila) – przed kliknięciem nie wiadomo, kto otwiera link.
-- Token nie jest zużywany. Funkcja dostępna wyłącznie dla service_role (wywołuje ją serwer aplikacji).
-- Migracja addytywna (nowa funkcja).

create function public.link_salon_name(p_token_hash text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select au.id, lower(au.email) as email
    from auth.users au
    where length(coalesce(p_token_hash, '')) >= 20
      and (au.recovery_token = p_token_hash or au.confirmation_token = p_token_hash)
    union
    select ot.user_id, lower(au.email)
    from auth.one_time_tokens ot
    join auth.users au on au.id = ot.user_id
    where length(coalesce(p_token_hash, '')) >= 20
      and ot.token_hash = p_token_hash
  )
  select coalesce(
    -- Konto z profilem (ustawienie hasła / reset).
    (select s.name
     from target t
     join public.users u on u.id = t.id and u.deleted_at is null
     join public.salons s on s.id = u.salon_id and s.deleted_at is null
     limit 1),
    -- Zaproszenie e-mailem (profil powstaje dopiero po potwierdzeniu).
    (select s.name
     from target t
     join public.invitations i on i.email = t.email and i.accepted_at is null and i.deleted_at is null
     join public.salons s on s.id = i.salon_id and s.deleted_at is null
     order by i.created_at desc
     limit 1)
  );
$$;

comment on function public.link_salon_name(text) is 'Nazwa salonu konta z linku do ustawienia hasła (bez zużywania tokenu). Tylko service_role.';

revoke execute on function public.link_salon_name(text) from public, anon, authenticated;
grant execute on function public.link_salon_name(text) to service_role;
