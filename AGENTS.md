# AGENTS.md – reguły dla agentów AI pracujących nad CreoCards

## Przed rozpoczęciem pracy
- Przeczytaj `docs/SPEC.md` (wymagania) i `docs/ROADMAP.md` (etapy i kryteria akceptacji).
- Realizuj wyłącznie etap wskazany w poleceniu. Nie wychodź poza jego zakres.
- Najpierw przedstaw plan (pliki, migracje, polityki RLS, testy) i **poczekaj na akceptację**.

## Stos
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS, PWA.
- Supabase: PostgreSQL, Auth, Storage. Region UE.
- Hosting: Vercel. Transkrypcja: zewnętrzne API speech-to-text.
- Język interfejsu: polski.

## Środowisko deweloperskie
- Środowisko dev to **WSL Ubuntu z Node 22 (nvm)**. Wszystkie polecenia `npm`, `npx`, `node` i Supabase CLI uruchamiaj w WSL (np. `wsl -e bash -lc 'source ~/.nvm/nvm.sh && npm ...'`), nigdy z Windowsa – `node_modules` zawiera binaria natywne dla Linuksa.
- Końce linii: LF (wymusza `.gitattributes`). Nie zmieniaj tego.
- Lokalna baza i testy RLS: `npx supabase start` + `npx supabase test db` (Docker w WSL).

## Baza danych – reguły bezwzględne
1. Każda zmiana schematu wyłącznie jako plik migracji w `supabase/migrations/`. Żadnych ręcznych zmian w panelu Supabase.
2. Migracje **tylko addytywne**: dodawanie tabel, kolumn, indeksów, polityk. Usunięcie, zmiana nazwy lub typu kolumny/tabeli – tylko po wyraźnej zgodzie w poleceniu.
3. Nigdy nie modyfikuj migracji, która została już zastosowana – twórz nową.
4. Każda tabela z danymi salonu ma: `id`, `salon_id`, `created_by`, `created_at`, `updated_at`, `deleted_at`.
5. Miękkie usuwanie: ustaw `deleted_at`, nigdy `DELETE` na danych użytkowników.
6. Row Level Security włączone na każdej tabeli; użytkownik widzi tylko dane swojego `salon_id`. Każda nowa tabela = nowe polityki + test RLS.
7. Migracje testuj na `staging`. Na `production` tylko po merge do `master` i po wykonaniu backupu.

## Dane i prywatność
- Alergie i uwagi zdrowotne traktuj jako dane wrażliwe; nie loguj ich do konsoli ani narzędzi zewnętrznych.
- Zdjęcia i nagrania tylko w prywatnych bucketach; dostęp przez podpisane linki z krótkim czasem ważności.
- Nie umieszczaj danych osobowych w URL-ach ani query stringach.
- Sekrety tylko w zmiennych środowiskowych; nigdy w repozytorium. Utrzymuj `.env.example` bez wartości.

## UX – zasady projektu
- Minimum pól obowiązkowych (klientka: imię, telefon, alergie).
- Wybór z listy i przyciski zamiast pisania.
- Nic nie blokuje zapisu; wizyta może być szkicem.
- Mobile first: projektuj pod telefon trzymany jedną ręką.
- Autozapis szkiców, także offline.

## Git i jakość
- Pracuj na gałęzi `feature/<etap>`; jeden etap = jeden pull request.
- Przed zakończeniem: lint, typecheck i testy muszą przechodzić.
- W opisie PR: co zrobiono, lista migracji, jak sprawdzić według kryteriów akceptacji.
- Nie dodawaj zależności bez uzasadnienia w planie.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
