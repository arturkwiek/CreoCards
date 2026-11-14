# Wdrożenie na staging: Supabase, Vercel, e-maile

Projekt Supabase: **creocards-staging** (`pjbrssmrjzyrnbmjbamp`, region eu-west-3, Paryż).
Wszystkie polecenia uruchamiaj w **WSL** w katalogu repozytorium.

## Stan obecny: bez własnego SMTP

Dopóki domena wysyłkowa **mail.studiocreotarnow.pl** nie jest zweryfikowana w Resend, staging działa **bez własnego SMTP**:

- E-maile (zaproszenia, reset hasła) wysyła wbudowana poczta Supabase. Dociera ona tylko na adresy członków zespołu projektu Supabase i wysyła kilka maili na godzinę. Wystarczy do testu z Twoim adresem.
- Uczennice zapraszasz **linkiem**:
  - w sekcji **Zespół** przycisk „Utwórz link zaproszenia”;
  - przy oczekującym zaproszeniu przycisk „Kopiuj link zaproszenia”.
- Link jest jednorazowy, ważny 24 godziny i działa tylko dla tej osoby. Przekaż go bezpośrednio, np. SMS-em. Każdy nowy link unieważnia poprzedni.

> Własny SMTP z domeną **mail.studiocreotarnow.pl** jest **wymagany przed pilotażem** (patrz `docs/SPEC.md`, `docs/ROADMAP.md`). Konfiguracja opisana jest w sekcji 6.

## 1. Konfiguracja Auth w repozytorium (`supabase/config.toml`)

Szablony e-maili, wyłączona rejestracja i minimalna długość hasła są zapisane w `supabase/config.toml` i wysyłane na projekt poleceniem `supabase config push`, bez ręcznych zmian w panelu.

Ustawienia tylko dla stagingu są w bloku `[remotes.staging]` na końcu pliku:
- `site_url` i dozwolone przekierowania (z `env(STAGING_SITE_URL)`);
- `enable_signup = false`;
- SMTP **wyłączony** (`enabled = false`). Gotowy blok Resend czeka obok w komentarzu.

> Jeśli `STAGING_SITE_URL` nie będzie ustawiony, linki w e-mailach będą błędne. Przed `config push` sprawdź: `echo $STAGING_SITE_URL`.

## 2. Wysłanie konfiguracji i migracji na staging

```bash
npx supabase login                                     # jednorazowo, otwiera przeglądarkę
npx supabase link --project-ref pjbrssmrjzyrnbmjbamp   # hasło bazy: Project Settings → Database

export STAGING_SITE_URL="https://<główny-adres>.vercel.app"   # bez ukośnika na końcu

npx supabase config push                               # Auth: szablony, site_url, enable_signup=false
npx supabase db push                                   # migracje z supabase/migrations
```

Sprawdź w panelu Supabase:
- **Authentication → Sign In / Providers**: „Allow new users to sign up” wyłączone;
- **Authentication → URL Configuration**: Site URL = adres aplikacji.

Zaproszenia działają mimo wyłączonej rejestracji, bo tworzy je serwer przez admin API (klucz service_role).

## 3. Vercel

**Settings → Environment Variables** dla środowiska, które serwuje główny adres. Po merge do `master` jest to zwykle **Production** w Vercel. Do czasu założenia produkcji Supabase zmienne wskazują na staging:

| Zmienna | Skąd |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (**tajny**) |

Po zmianie zmiennych zrób **Redeploy**.

## 4. Pierwsza właścicielka

W `.env.local` ustaw wartości stagingu (te same trzy zmienne co w Vercel), następnie jedno z dwóch:

```bash
# A) e-mail z zaproszeniem (wbudowana poczta – tylko na adres członka zespołu projektu Supabase)
npm run bootstrap -- --salon "Creo" --email twoj@adres.pl --name "Imię"

# B) link wypisany w terminalu, bez e-maila
npm run bootstrap -- --salon "Creo" --email twoj@adres.pl --name "Imię" --link
#    adres aplikacji z STAGING_SITE_URL albo: --site-url https://<główny-adres>.vercel.app
```

Skrypt zakłada salon (lub używa istniejącego) i zaproszenie właścicielki. Ponowne uruchomienie tworzy nowy link lub e-mail dla tego samego zaproszenia. Po otwarciu linku właścicielka ustawia hasło i może zapraszać uczennice w sekcji **Zespół**.

## 5. Kryteria akceptacji Etapu 1

1. Właścicielka loguje się, a w sekcji **Zespół** tworzy link zaproszenia dla uczennicy.
2. Uczennica otwiera link na swoim telefonie, ustawia hasło i loguje się.
3. Bez zaproszenia nie da się założyć konta: w aplikacji nie ma rejestracji, a API zwraca `signup_disabled`.
4. Test RLS przechodzi w CI (zadanie `db-test`).

## 6. Przed pilotażem: SMTP Resend z domeną mail.studiocreotarnow.pl

1. Załóż konto na [resend.com](https://resend.com) (region UE, jeśli jest do wyboru).
2. **Domains → Add Domain**: `mail.studiocreotarnow.pl`.
3. U dostawcy DNS domeny `studiocreotarnow.pl` dodaj rekordy pokazane przez Resend (SPF, DKIM, opcjonalnie DMARC). Poczekaj na status **Verified**.
4. **API Keys → Create API Key**: uprawnienie *Sending access*, tylko ta domena. Klucz `re_…` jest hasłem SMTP.
5. W `supabase/config.toml` zamień blok `[remotes.staging.auth.email.smtp]` z `enabled = false` na zakomentowany blok Resend znajdujący się pod nim. Odkomentuj też `[remotes.staging.auth.rate_limit]`. Zmianę zrób przez PR.
6. Wyślij konfigurację:

   ```bash
   export STAGING_SITE_URL="https://<główny-adres>.vercel.app"
   export SMTP_ADMIN_EMAIL="noreply@mail.studiocreotarnow.pl"
   read -rs SMTP_PASS && export SMTP_PASS     # wklej klucz re_… (nie zapisze się w historii)
   npx supabase config push
   ```

7. Sprawdź w panelu: **Authentication → Emails → SMTP Settings** jest włączone, host `smtp.resend.com`.

| Pole SMTP | Wartość |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Użytkownik | `resend` |
| Hasło | klucz API `re_…` |
| Nadawca | `noreply@mail.studiocreotarnow.pl` |
| Nazwa nadawcy | `CreoCards` |

## Testy

- Testy RLS uruchamia CI (zadanie `db-test`: `supabase start` + `supabase test db`).
- Lokalnie (opcjonalnie): `npx supabase start` + `npm run db:test`. Wymaga Dockera z siecią bridge.
