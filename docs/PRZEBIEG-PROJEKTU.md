# CreoCards – przebieg projektu (quick guide)

Dokument dla osoby, która zna technologie webowe, ale nie robiła wcześniej takiego wdrożenia: aplikacji budowanej etapami przez agenta AI, z bazą Supabase, hostingiem Vercel i pracą w WSL. Opisuje **skąd przyszliśmy, gdzie jesteśmy i dokąd zmierzamy**, oraz dlaczego zapadły poszczególne decyzje.

> Stan na: 15.11.2026, 13:30 – **Etap 1 zamknięty**, poprawka linków („Kontynuuj”, PR #8) scalona, **Etap 2 – Klientki w trakcie** (agent pisze kod).

---

## 0. Najpierw to: cały projekt bez żargonu

Jeśli gubisz się w PR-ach, migracjach i zmiennych – przeczytaj tylko tę sekcję. Reszta dokumentu to szczegóły dla dociekliwych.

### Co budujemy
Aplikację na telefon dla salonu Creo: kartoteka klientek, receptury farb, zdjęcia fryzur, magazyn farb. Działa jak zwykła aplikacja (ikona na ekranie telefonu), ale technicznie jest stroną internetową – dlatego nie trzeba jej publikować w Google Play ani App Store.

### Kto co robi
| Kto | Rola | Porównanie |
|---|---|---|
| **Ty (Artur)** | Podejmujesz decyzje: akceptujesz plany, sprawdzasz aplikację na telefonie, klikasz rzeczy, których nikt inny nie może (logowanie, linki, domena). | inwestor na budowie |
| **Agent** (okno terminala ze znakiem `❯`) | Pisze kod, ustawia serwery, poprawia błędy. Zawsze najpierw pokazuje plan i czeka na Twoje „akceptuję”. | ekipa budowlana |
| **Claude w czacie** | Tłumaczy, co się dzieje, sprawdza plany agenta, przygotowuje Ci gotowe wiadomości do wklejenia agentowi. | kierownik budowy / doradca |

Agent i Claude w czacie **nie widzą się nawzajem** – łączysz ich Ty, wklejając wiadomości.

### Narzędzia – po co każde z nich
| Narzędzie | Po ludzku | Po co nam |
|---|---|---|
| **GitHub** | segregator z całym kodem i historią każdej zmiany | nic nie ginie, każdą zmianę da się cofnąć |
| **PR** (pull request, np. „PR #7”) | propozycja zmiany do zatwierdzenia | agent nie zmienia aplikacji „po cichu” – każda zmiana to osobna propozycja |
| **CI** (zielony ptaszek / czerwony krzyżyk) | automatyczny kontroler jakości | przed każdą zmianą sprawdza, czy nic się nie zepsuło i czy dane są dobrze zabezpieczone |
| **Scalenie** („scal”, „merge”) | zatwierdzenie propozycji | dopiero po scaleniu zmiana trafia do aplikacji |
| **Vercel** | wynajęty lokal, w którym „stoi” aplikacja | dzięki niemu działa pod adresem `creo-cards.vercel.app` na każdym telefonie |
| **Supabase** | sejf z kartoteką + recepcja sprawdzająca, kto wchodzi | trzyma dane (w Paryżu, w UE) i obsługuje logowanie |
| **Migracja** | instrukcja „dobuduj w sejfie nową szufladę” | zmiany w bazie są zapisane i powtarzalne, nikt nie klika ich ręcznie |
| **Resend** (później) | poczta wychodząca salonu | żeby maile z zaproszeniami dochodziły – wymaga domeny `studiocreotarnow.pl` |
| **WSL** | warsztat Linuksa wewnątrz Windowsa | tam agent uruchamia narzędzia; Ty prawie nie musisz tam zaglądać |
| **Staging** | salon próbny z manekinami | tu testujemy; **tylko wymyślone dane**, żadnych prawdziwych klientek |
| **Produkcja** (później) | prawdziwy salon | osobna, zabezpieczona baza – powstanie przed pilotażem |

### Jak wygląda jeden etap
1. Agent pokazuje **plan** → wklejasz go Claude'owi w czacie → dostajesz ocenę i gotową odpowiedź.
2. Wklejasz agentowi „akceptuję” (ewentualnie z poprawkami).
3. Agent pisze kod i tworzy **PR**; kontroler (CI) sprawdza.
4. Sprawdzasz na telefonie, czy działa → „scal”.
5. Etap zamknięty, agent proponuje kolejny.

### Co się wydarzyło do tej pory (po ludzku)
1. **Opisaliśmy aplikację** – co ma robić, dla kogo, w jakiej kolejności ją budować.
2. **Postawiliśmy fundament** (Etap 0) – pusta aplikacja z logo „C”, którą da się dodać do ekranu telefonu.
3. **Uruchomiliśmy ją w internecie** – założenie kont w Vercel i Supabase, wpisanie kluczy, podłączenie bazy. Stąd dużo klikania 14–15.11 – to jednorazowe.
4. **Zrobiliśmy logowanie i zespół** (Etap 1) – konta tylko z zaproszenia, role właścicielka/uczennica.
5. **Trafiliśmy na problem z mailami** – bez własnej domeny maile z zaproszeniami nie dochodzą. Obejście: właścicielka wysyła **link** SMS-em lub WhatsAppem.
6. **Trafiliśmy na problem z linkami** – skanery poczty i podglądy w komunikatorach „klikały” link za człowieka i go zużywały. Naprawione: link otwiera stronę z przyciskiem **„Kontynuuj”**.
7. **Teraz: klientki** (Etap 2) – lista, wyszukiwanie, szybkie dodawanie z alergiami.

### Co Ty musisz robić, a czego nie
- **Musisz:** czytać krótkie podsumowania, akceptować plany, testować na telefonie, wklejać wiadomości między czatem a agentem.
- **Nie musisz:** rozumieć kodu, migracji ani poleceń w terminalu – to robi agent.
- **Raz, przed pilotażem:** rekordy DNS domeny (dla maili), decyzja o płatnym planie hostingu, przekazanie roli właścicielki Kindze.

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

> **Na stagingu wyłącznie dane testowe** – żadnych prawdziwych klientek (imiona, telefony, alergie) do czasu uruchomienia produkcji. Testowe wpisy oznaczaj np. „Test …”.

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
- [x] `/auth/confirm` z przyciskiem „Kontynuuj” (PR #8) – podglądy linków w SMS/WhatsApp i skanery poczty nie zużywają tokenu
- [x] Etap 2 – Klientki (PR #9): migracja `clients` na stagingu (`db push --remote`), testy RLS w CI
- [ ] Kryteria akceptacji Etapu 2 na telefonie: dodanie klientki w < 20 s, wyszukanie po 3 cyfrach telefonu

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
- Produkcja na **Supabase Pro** (UE): kopie dzienne, 7 dni – i **udana próba przywrócenia** (runbook z Etapu 4a).
- SMTP Resend z domeną `mail.studiocreotarnow.pl` – **opcjonalnie** (od Etapu 1b uczennice logują się loginem; e-mail tylko do odzyskiwania konta właścicielki).
- Własna domena aplikacji, np. `app.studiocreotarnow.pl`.
- Przekazanie roli właścicielki fryzjerce (**Kinga**) – konto testowe/założycielskie przestaje być właścicielem salonu.
- Plan Vercel: Hobby jest niekomercyjny – przed użyciem w salonie Pro albo inny hosting.
- Supabase Pro zamiast Free (Free usypia nieużywane projekty po 7 dniach); łączny koszt z Vercel Pro ok. 200 zł/mies.
- Region funkcji Vercel przenieść do UE (domyślnie USA) – dane klientek przechodzą przez serwer aplikacji.

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

- Na stagingu **wyłącznie dane testowe** – prawdziwe klientki dopiero na produkcji.
- `npm` i `npx` **tylko w WSL**.
- Zmiany bazy **tylko migracjami** w repo – nigdy klikaniem w panelu Supabase.
- Klucz **secret/service_role** nigdy w repo, czacie ani w kodzie po stronie przeglądarki.
- Po zmianie zmiennych w Vercel – **Redeploy**.
- `db push` zawsze z `--remote`. Przed potwierdzeniem `config push` przejrzyj diff – nie powinno w nim być szablonów e-maili, dopóki nie ma SMTP.
- Darmowy plan Supabase bez własnego SMTP nie pozwala zmieniać szablonów e-maili – wrócą razem z Resend.

---

## 9. Pełny stos technologiczny

Prosta z wierzchu aplikacja stoi na zestawie narzędzi i praktyk typowym dla profesjonalnych produktów SaaS. Większość tej złożoności to jednorazowa konfiguracja – na co dzień działa sama.

### 9.1 Aplikacja (to, co widzi użytkownik)
- **Next.js 16** (Turbopack) – framework aplikacji webowej
- **React** – budowa interfejsu
- **TypeScript** (strict) – JavaScript z kontrolą typów
- **Tailwind CSS** – wygląd i układ ekranów
- **PWA** – manifest, ikony, service worker; instalacja na telefonie jak aplikacja natywna
- **Server Actions** i **proxy** (dawne middleware) – logika serwerowa i pilnowanie zalogowania

### 9.2 Dane i logowanie
- **Supabase** – platforma zaplecza (backend-as-a-service), region UE (Paryż, eu-west-3)
- **PostgreSQL** – relacyjna baza danych
- **Supabase Auth** – konta, hasła, zaproszenia, blokowanie dezaktywowanych kont
- **Supabase Storage** – zdjęcia (od Etapu 5)
- **Row Level Security (RLS)** – reguły dostępu w samej bazie; salon widzi tylko swoje dane
- **Triggery i funkcje SQL** (`SECURITY DEFINER`) – pilnowanie ról, audytu, miękkiego usuwania
- **Migracje SQL** – wersjonowane zmiany struktury bazy
- **Konfiguracja jako kod** – `supabase/config.toml` z blokami `[remotes.*]`, wysyłana `config push` po `config diff`
- **Generowane typy TypeScript** ze schematu bazy

### 9.3 Jakość i testy
- **ESLint** – statyczna analiza kodu
- **TypeScript typecheck** – błędy typów wykrywane przed uruchomieniem
- **Vitest** – testy jednostkowe (walidacja, wyszukiwanie, przekierowania)
- **pgTAP** – testy zabezpieczeń bazy (izolacja salonów, role, brak DELETE)
- **Testy end-to-end** przepływów (zaproszenie → hasło → logowanie → dezaktywacja) na tymczasowym stosie

### 9.4 Kod i współpraca
- **Git** – kontrola wersji; `.gitattributes` z `eol=lf`
- **GitHub** – repozytorium, pull requesty, squash merge
- **GitHub CLI (`gh`)** – obsługa PR z terminala
- **Workflow etapowy** – gałąź → PR → przegląd → akceptacja → merge

### 9.5 CI/CD – automatyczna kontrola i wdrażanie
- **GitHub Actions** – lint, typecheck, testy jednostkowe przy każdym PR
- **Docker** w CI – zadanie `db-test` stawia lokalną kopię Supabase i uruchamia testy RLS
- **Vercel** – automatyczny build i publikacja po każdym merge
  - środowiska **Production** i **Preview** (osobny podgląd każdego PR)
  - zmienne środowiskowe typu **Config** i **Secret**
  - **Vercel CLI** – zmienne, logi, wdrożenia z terminala

### 9.6 Środowisko pracy
- **Windows + WSL** (Ubuntu 22.04)
- **nvm + Node.js 22**
- **npm** – zależności i skrypty (`dev`, `bootstrap`, `db:test`)
- **Supabase CLI** – `login`, `link`, `config diff`, `config push`, `db push --remote`
- **VS Code** – edytor
- **`.env.local`** – lokalne klucze poza repozytorium

### 9.7 Sztuczna inteligencja w procesie
- **Claude Code (agent)** – kod, testy, infrastruktura; tryb auto z regułami
- **Claude w czacie** – architektura, przegląd planów, diagnoza, prowadzenie krok po kroku
- **AGENTS.md** – reguły pracy agenta (bezpieczeństwo danych, uprawnienia do infrastruktury, WSL)

### 9.8 Dokumentacja
- `SPEC.md` (wymagania), `ROADMAP.md` (etapy i kryteria), `WDROZENIE-STAGING.md` (runbook), `PRZEWODNIK.md` (dla salonu), `PRZEBIEG-PROJEKTU.md` (historia i decyzje)
- **Markdown** wersjonowany razem z kodem

### 9.9 Bezpieczeństwo i prywatność
- Dane w **UE** (RODO); alergie jako dane wrażliwe
- Konta **tylko z zaproszenia**, publiczna rejestracja wyłączona
- **Jednorazowe linki** z przyciskiem „Kontynuuj” (odporne na skanery poczty i podglądy w komunikatorach)
- **Miękkie usuwanie** i pola audytu w każdym rekordzie
- **Rozdział środowisk** – staging tylko z danymi testowymi; osobna produkcja przed pilotażem
- Sekrety wyłącznie w zmiennych środowiskowych

### 9.10 Zaplanowane (jeszcze nie wdrożone)
- **Resend** (SMTP) z domeną `mail.studiocreotarnow.pl` i rekordami DNS (SPF, DKIM)
- **API rozpoznawania mowy** (np. Whisper) – notatki głosowe
- **Produkcyjny projekt Supabase** z backupami i Point-in-Time Recovery
- **Własna domena** aplikacji (`app.studiocreotarnow.pl`)
- **Region funkcji Vercel w UE** (np. Frankfurt) przed produkcją
- **Płatne plany** do użytku komercyjnego: Vercel Pro (ok. 20 USD/mies.), Supabase Pro (ok. 25 USD/mies.) – łącznie ok. 200 zł/mies. na salon
