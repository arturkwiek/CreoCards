-- Tabele z danymi tożsamości, których kopia nie obejmuje (MFA, passkeys, SSO, OAuth).
-- Zwraca nazwy niepustych – backup przerywa się, żeby nic nie zginęło po cichu.
select t from unnest(array[
  'auth.mfa_factors', 'auth.webauthn_credentials', 'auth.sso_providers', 'auth.saml_providers',
  'auth.oauth_clients', 'auth.custom_oauth_providers', 'auth.scim_users'
]) as t
where to_regclass(t) is not null
  and (xpath('/row/c/text()', query_to_xml(format('select exists (select 1 from %s) as c', t), false, true, '')))[1]::text = 'true';
