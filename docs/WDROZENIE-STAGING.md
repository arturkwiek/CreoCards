# Wdrożenie na staging: Supabase, SMTP (Resend), Vercel

Projekt Supabase: **creocards-staging** (region eu-west-3, Paryż).
Wszystkie polecenia uruchamiaj w **WSL** w katalogu repozytorium.

## 1. Resend – własny SMTP dla e-maili zaproszeń i resetu hasła

Wbudowany serwer pocztowy Supabase wysyła tylko kilka maili na godzinę i tylko do członków zespołu projektu, więc nie nadaje się do zaproszeń.

1. Załóż konto na [resend.com](https://resend.com). Wybierz region UE, jeśli Resend o niego zapyta.
2. **Domains → Add Domain**. Podaj domenę lub subdomenę, z której będą wychodzić maile, np. `mail.twojadomena.pl`.
3. Dodaj u swojego dostawcy DNS rekordy, które pokaże Resend (SPF, DKIM, opcjonalnie DMARC). Poczekaj, aż status zmieni się na **Verified**.
   - Bez zweryfikowanej domeny Resend wysyła tylko na Twój własny adres, więc zaproszenia do uczennic nie dojdą.
4. **API Keys → Create API Key**: uprawnienie *Sending access*, ograniczone do tej domeny. Skopiuj klucz `re_…`. To jest hasło SMTP.
5. Dane SMTP:

   | Pole | Wartość |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Użytkownik | `resend` |
   | Hasło | klucz API `re_…` |
   | Nadawca | np. `noreply@mail.twojadomena.pl` (adres w zweryfikowanej domenie) |
   | Nazwa nadawcy | `CreoCards` |

## 2. Konfiguracja Auth w repozytorium (`supabase/config.toml`)

Szablony e-maili, wyłączona rejestracja, minimalna długość hasła i SMTP są zapisane w `supabase/config.toml` i wysyłane na projekt poleceniem `supabase config push`, bez ręcznych zmian w panelu.

Ustawienia tylko dla stagingu są w bloku `[remotes.staging]` na końcu `supabase/config.toml` (Project ref `pjbrssmrjzyrnbmjbamp`). Obejmują one: `site_url`, dozwolone przekierowania, wyłączoną rejestrację, limit e-maili i SMTP Resend. Wartości `env(...)` CLI odczytuje z powłoki w chwili `config push`.

> Jeśli `STAGING_SITE_URL` nie będzie ustawiony, linki w e-mailach będą błędne. Przed `config push` sprawdź: `echo $STAGING_SITE_URL`.

## 3. Wysłanie konfiguracji i migracji na staging

```bash
npx supabase login                              # jednorazowo, otwiera przeglądarkę
npx supabase link --project-ref pjbrssmrjzyrnbmjbamp   # hasło bazy: Project Settings → Database

export STAGING_SITE_URL="https://<stały-adres-stagingu>.vercel.app"   # bez ukośnika na końcu
export SMTP_ADMIN_EMAIL="noreply@mail.twojadomena.pl"
read -rs SMTP_PASS && export SMTP_PASS          # wklej klucz re_… (nie zapisze się w historii)

npx supabase config push                        # Auth: szablony, SMTP, site_url, enable_signup=false
npx supabase db push                            # migracje z supabase/migrations
```

Sprawdź w panelu Supabase:
- **Authentication → Emails → SMTP Settings**: włączone, host `smtp.resend.com`;
- **Authentication → Sign In / Providers**: „Allow new users to sign up” wyłączone;
- **Authentication → URL Configuration**: Site URL = adres stagingu.

Zaproszenia działają mimo wyłączonej rejestracji, bo wysyła je serwer przez admin API (klucz service_role).

## 4. Vercel

**Settings → Environment Variables**, środowisko **Preview** (staging):

| Zmienna | Skąd |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (**tajny**) |

`STAGING_SITE_URL` powinien być stałym adresem, np. aliasem gałęzi `master` w Vercel (Settings → Domains), a nie adresem pojedynczego deploymentu.

## 5. Pierwsza właścicielka

W `.env.local` ustaw wartości stagingu (te same trzy zmienne co w Vercel), następnie:

```bash
npm run bootstrap -- --salon "Creo" --email adres@wlascicielki.pl --name "Imię"
```

Skrypt zakłada salon i wysyła zaproszenie. Po kliknięciu linku właścicielka ustawia hasło i może zapraszać uczennice w sekcji **Zespół**.

## Lokalnie

- Testy RLS uruchamia CI (zadanie `db-test`: `supabase start` + `supabase test db`).
- Lokalnie (opcjonalnie): `npx supabase start` + `npm run db:test`. Wymaga Dockera z siecią bridge.
