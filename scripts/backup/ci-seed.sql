-- Dane testowe dla testu backupu w CI (lokalna baza): konto, salon, klientka, wizyta, bucket Storage (pliki wysyła
-- krok CI przez S3, żeby wpisy storage.objects miały prawdziwe pliki),
-- oraz sesja (tabela wewnętrzna, którą kopia ma pominąć).
do $$
declare
  uid uuid := '00000000-0000-4000-8000-0000000000b1';
  sid uuid := '00000000-0000-4000-8000-0000000000b2';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'ci-backup@example.com',
          crypt('ci-haslo-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', 'ci-backup@example.com'), 'email', now(), now(), now());
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values ('00000000-0000-4000-8000-0000000000b3', uid, now(), now());

  insert into public.salons (id, name, created_by) values (sid, 'Salon CI', uid);
  insert into public.users (id, salon_id, role, full_name, email, created_by)
  values (uid, sid, 'owner', 'Właścicielka CI', 'ci-backup@example.com', uid);
  insert into public.clients (salon_id, full_name, phone, allergy_status, allergies, created_by)
  values (sid, 'Klientka CI', '600100200', 'has', 'test', uid);
end $$;

insert into storage.buckets (id, name, public) values ('ci-backup', 'ci-backup', false);

