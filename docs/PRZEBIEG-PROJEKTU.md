# CreoCards – przebieg projektu (quick guide)

Dokument dla osoby, która zna technologie webowe, ale nie robiła wcześniej takiego wdrożenia: aplikacji budowanej etapami przez agenta AI, z bazą Supabase, hostingiem Vercel i pracą w WSL. Opisuje **skąd przyszliśmy, gdzie jesteśmy i dokąd zmierzamy**, oraz dlaczego zapadły poszczególne decyzje.

> Stan na: 15.11.2026 – **Etap 1 zaakceptowany** na stagingu (Vercel + Supabase). Następny: Etap 2 – Klientki (plan do akceptacji).

---

## 1. O co chodzi w projekcie

Studio fryzur **Creo** (Tarnów, domena `studiocreotarnow.pl`) potrzebuje aplikacji do:
- kartoteki klientek (minimum pól: imię, telefon, alergie),
- zapisywania wizyt i **receptur koloryzacji** (farby, gramy, utleniacz, proporcje, czas),
- zdjęć gotowej fryzury, notatek głosowych, szkiców wizyt,
- magazynu farb (automatyczne odejmowanie zużycia).

Zespół: **właścicielka** (fryzjerka) + **2 uczennice**. Finanse – później, ale dane pod nie zbieramy od początku.

Szczegóły wymagań: [`SPEC.md`](SPEC.md). Etapy: [`ROADMAP.md`](ROADMAP.md). Reguły dla agenta: [`../AGENTS.md`](../AGENTS.md).

---

## 2. Architektura w jednym akapicie

Jedna aplikacja webowa (**PWA** – instalowana na telefonie „Dodaj do ekranu głównego”) w **Next.js**. Kod na **GitHubie**. **Vercel** buduje i hostuje aplikację po każdym merge do `master`. Dane, logowanie i pliki są w **Supabase** (PostgreSQL + Auth + Storage, region UE). Nikt nie trzyma lokalnej kopii danych – wszystkie telefony widzą ten sam stan.

```
Telefon (PWA) ──► Vercel (Next.js) ──► Supabase (Postgres, Auth, Storage) – Paryż, UE
                      ▲
GitHub (master) ──────┘   push/merge = automatyczne wdrożenie
```

### Słowniczek narzędzi

| Narzędzie | Do czego służy w projekcie |
|---|---|
| **GitHub** | Repozytorium kodu, pull requesty (PR), CI (GitHub Actions) uruchamiające testy przy każdym PR. |
| **Agent AI (Claude Code)** | Pisze kod etapami. Każdy etap = gałąź + PR. Najpierw plan, potem implementacja po akceptacji. |
| **Supabase** | Baza PostgreSQL, logowanie (Auth), przechowywanie zdjęć (Storage). Zarządzana z repo przez **Supabase CLI**. |
| **Migracje** | Pliki SQL w `supabase/migrations/`. Każda zmiana bazy = nowy plik. Nigdy ręcznie w panelu. |
| **RLS** (Row Level Security) | Reguły w bazie: użytkownik widzi tylko dane swojego salonu. Testowane automatycznie (pgTAP w CI). |
| **Vercel** | Hosting. Bierze kod z GitHuba, buduje, wystawia pod adresem `https://…vercel.app`. |
| **Resend** | Serwer pocztowy (SMTP) do maili z zaproszeniami i resetem hasła. Wymaga własnej domeny. |
| **WSL** | Linux (Ubuntu) w Windows. Tu uruchamiamy `npm`, `npx supabase` i dev server. |
| **PWA** | Strona, którą można „zainstalować” na telefonie jak aplikację – bez sklepów z aplikacjami. |

### Środowiska

| Środowisko | Gdzie | Status |
|---|---|---|
| **Lokalne** | WSL, `npm run dev` → `http://localhost:3000` (lub 3001) | działa |
| **Staging** | Vercel (główny adres) + Supabase `creocards-staging` (`pjbrssmrjzyrnbmjbamp`, eu-west-3 Paryż) | wdrożony, Etap 1 zaakceptowany |
| **Produkcja** | osobny projekt Supabase + docelowo `app.studiocreotarnow.pl` | przed pilotażem |

Do czasu założenia produkcji **główny adres Vercel pełni rolę stagingu**.

---

## 3. Jak pracujemy z agentem (workflow etapu)

1. Prosisz agenta: *„Realizujemy Etap N. Najpierw przedstaw plan.”*
2. Agent czyta `SPEC.md`, `ROADMAP.md`, `AGENTS.md` i pokazuje plan: tabele, migracje, polityki RLS, ekrany, testy.
3. Ty akceptujesz (ew. z poprawkami). Agent tworzy gałąź `feature/…`, koduje, otwiera PR.
4. CI na GitHubie uruchamia lint, typecheck, testy jednostkowe i testy RLS (`db-test`).
5. Wdrażasz na staging (migracje + Vercel), sprawdzasz **kryteria akceptacji** na telefonie.
6. Merge do `master` → Vercel sam publikuje nową wersję.

Zasady bezpieczeństwa danych (pełna lista w `AGENTS.md`): migracje tylko dodają (nic nie kasują bez zgody), miękkie usuwanie (`deleted_at`), backup przed migracją na produkcji, sekrety tylko w zmiennych środowiskowych.

> Agent pracuje w terminalu (osobne okno). Odpowiedzi i polecenia wklejasz mu ręcznie przy znaku `❯`.

---

## 4. Przebieg – co zostało zrobione i dlaczego

### 14.11 – Koncepcja i dokumentacja
- Ustalone wymagania (minimum pól, receptura z mieszanek, wybór z list, notatki głosowe, szkice, zdjęcia).
- Wybór stosu: PWA (Next.js) zamiast aplikacji natywnej – jedna wersja na wszystkie telefony, bez sklepów, aktualizacje automatyczne.
- Powstały `SPEC.md`, `ROADMAP.md`, `AGENTS.md`, `PRZEWODNIK.md`, przykładowy CSV katalogu.

### Etap 0 – Fundament (PR #1, scalony)
- Szkielet Next.js 16 + TypeScript + Tailwind, PWA (manifest, ikony, service worker), klient Supabase, Vitest, CI.

### Problemy środowiska lokalnego (rozwiązane)
| Problem | Przyczyna | Rozwiązanie |
|---|---|---|
| `node -v` = 12 w WSL | domyślny Node z apt | Node 22 przez **nvm** |
| `node_modules` nie działa w WSL | zainstalowany wcześniej pod Windows (binarki win32) | `rm -rf node_modules .next && npm ci` w WSL |
| Pliki „całe zmienione” w gicie | końce linii CRLF/LF | `.gitattributes` z `eol=lf` |
| `npm` z dwóch systemów | Windows i WSL nadpisują sobie biblioteki | **zasada: `npm` tylko w WSL** (zapisana w `AGENTS.md`) |
| Port 3000 zajęty | inny proces | dev server sam wybiera 3001 |

### Supabase – projekt stagingu
- Pierwszy projekt powstał w Londynie → usunięty i założony ponownie jako `creocards-staging` w **Paryżu (UE)**, bo dane klientek (w tym alergie) to dane wrażliwe (RODO).
- Klucze w `.env.local` (plik ignorowany przez git). **Publishable key** jest publiczny; **secret / service_role** – tylko w `.env.local` i w Vercel, nigdy w repo ani w czacie.

### Etap 1 – Konta i role (PR #2, scalony)
- Tabele `salons`, `users`, `invitations`; role **owner** (właścicielka) i **apprentice** (uczennica).
- RLS: dostęp tylko do własnego salonu; uczennica nie zaprasza i nie zmienia ról; brak DELETE.
- Logowanie e-mail + hasło (bez magic linka – w PWA link z maila otwiera się w przeglądarce, nie w aplikacji).
- Publiczna rejestracja wyłączona (`enable_signup = false`); konta tylko z zaproszenia.
- Dezaktywacja konta = `deleted_at` + ban w Supabase Auth (unieważnia sesje).
- Testy RLS: 37/37 w CI. Skrypt `npm run bootstrap` zakłada salon i pierwsze konto.

### Link zaproszenia zamiast maila (PR #3, scalony)
- Domena do wysyłki maili (`mail.studiocreotarnow.pl` w Resend) **odłożona**. Bez niej wbudowana poczta Supabase wysyła tylko do członków zespołu projektu, a Resend tylko na adres właściciela konta.
- Obejście: właścicielka tworzy **link zaproszenia** (jednorazowy, 24 h) i wysyła go uczennicy SMS-em. `npm run bootstrap … --link` wypisuje link w terminalu.
- SMTP na stagingu wyłączony; gotowa konfiguracja Resend czeka w komentarzu w `supabase/config.toml`.

---

## 5. Gdzie jesteśmy teraz

Wdrożenie stagingu według [`WDROZENIE-STAGING.md`](WDROZENIE-STAGING.md):

- [x] Konto Vercel (plan Hobby), repo podpięte, projekt `creo-cards` utworzony
- [x] Zmienne w Vercel (Production i Preview, wszystkie gałęzie; `SUPABASE_SERVICE_ROLE_KEY` jako Secret) + **Redeploy** – build `master` zielony
- [x] Główny adres Vercel: `https://creo-cards.vercel.app` (wpisany na stałe w `[remotes.staging]` w `config.toml`)
- [x] `SUPABASE_SERVICE_ROLE_KEY` dopisany do `.env.local`
- [x] W WSL: `npx supabase login` → `link` → `db push --remote` (migracja konta_i_role na stagingu)
- [x] Vercel CLI w WSL połączone z projektem (`vercel link`, zespół `vision-rd`); stare zmienne Preview przypięte do gałęzi PR #4 usunięte
- [x] `config push` po scaleniu PR #4 i #5 – wysłane tylko celowe zmiany (adres i przekierowania, `enable_signup = false`, hasło min. 8 znaków z literami i cyframi, linki ważne 24 h); `config diff` po pushu pusty. Szablony e-maili wyłączone do czasu SMTP
- [x] `npm run bootstrap -- --salon "Creo" --email … --name "Artur" --link` – salon „Creo” założony, link zaproszenia właścicielki wygenerowany (15.11, ważny 24 h)
- [x] Właścicielka otwiera link, ustawia hasło i loguje się
- [x] Poprawki po teście (PR #7): „Utwórz link do ustawienia hasła” w Zespole, zaproszenia e-mailem i reset e-mailem ukryte do czasu SMTP (`AUTH_EMAILS_ENABLED`), zachęta do uzupełnienia imienia; dostęp kont zaproszonych e-mailem przywrócony
- [x] **Kryteria akceptacji Etapu 1** na telefonie: właścicielka i uczennica zalogowane, uczennica nie zarządza zespołem, rejestracja wyłączona, PWA na ekranie głównym – **Etap 1 zaakceptowany (15.11)**

---

## 6. Dokąd zmierzamy

| Etap | Zakres |
|---|---|
| 2 | Klientki – lista, wyszukiwanie, formularz minimalny |
| 3 | Katalog preparatów – marki, odcienie, import CSV |
| 4 | Wizyty i receptury – mieszanki, „Powtórz ostatnią” |
| 5 | Zdjęcia – aparat w PWA, oś czasu klientki |
| 6 | Notatki głosowe – nagrywanie i transkrypcja |
| 7 | Szkice – autozapis, offline, przypomnienia |
| 8 | Magazyn – zużycie, alerty niskiego stanu |
| 9 | Onboarding – ekran powitalny, klientka testowa |
| 10 | Pilotaż w salonie |

**Do zrobienia przed pilotażem:**
- SMTP Resend z domeną `mail.studiocreotarnow.pl` (rekordy DNS u dostawcy domeny).
- Projekt Supabase **produkcyjny** (UE) + backupy.
- Własna domena aplikacji, np. `app.studiocreotarnow.pl`.
- Przekazanie roli właścicielki fryzjerce (**Kinga**) – konto testowe/założycielskie przestaje być właścicielem salonu.
- Plan Vercel: Hobby jest niekomercyjny – przed użyciem w salonie Pro albo inny hosting.

---

## 7. Ściąga poleceń (WSL, katalog repo)

```bash
npm run dev                         # aplikacja lokalnie
npm run lint && npm run typecheck   # kontrola kodu
npm test                            # testy jednostkowe

npx supabase login                  # jednorazowo
npx supabase link --project-ref pjbrssmrjzyrnbmjbamp
npx supabase config push            # ustawienia Auth z config.toml
npx supabase db push --remote       # migracje na staging (bez --remote celuje w lokalną bazę!)

npm run bootstrap -- --salon "Creo" --email adres@przyklad.pl --name "Imię" --link
```

## 8. Zasady, o których łatwo zapomnieć

- `npm` i `npx` **tylko w WSL**.
- Zmiany bazy **tylko migracjami** w repo – nigdy klikaniem w panelu Supabase.
- Klucz **secret/service_role** nigdy w repo, czacie ani w kodzie po stronie przeglądarki.
- Po zmianie zmiennych w Vercel – **Redeploy**.
- `db push` zawsze z `--remote`. Przed potwierdzeniem `config push` przejrzyj diff – nie powinno w nim być szablonów e-maili, dopóki nie ma SMTP.
- Darmowy plan Supabase bez własnego SMTP nie pozwala zmieniać szablonów e-maili – wrócą razem z Resend.
