# CreoCards – roadmapa wdrożenia dla agenta AI

Jeden etap = jedno zadanie dla agenta = osobna gałąź i pull request. Kolejny etap dopiero po akceptacji poprzedniego.

## Stały workflow każdego etapu

1. Agent czyta `docs/SPEC.md`, `docs/ROADMAP.md` i `AGENTS.md`.
2. Agent przedstawia krótki plan zmian (pliki, migracje, testy) i czeka na akceptację.
3. Implementacja na gałęzi `feature/<etap>`; zmiany bazy wyłącznie jako migracje.
4. Testy + wdrożenie na `staging` (preview Vercel).
5. Właściciel projektu sprawdza na telefonie według kryteriów akceptacji.
6. Merge do `master` → backup → migracja i wdrożenie na `production`.

## Etapy MVP

| Etap | Zakres | Kryteria akceptacji |
| --- | --- | --- |
| 0. Fundament | Szkielet Next.js + TS + Tailwind, Supabase, PWA (manifest, ikona), ESLint, CI na GitHubie | Aplikacja działa na Vercel preview i daje się dodać do ekranu głównego |
| 1. Konta i role | Logowanie, zaproszenia, role Właścicielka/Uczennica, tabele `salons`, `users`, RLS | Zaproszona osoba loguje się; bez zaproszenia rejestracja niemożliwa; test RLS przechodzi |
| 2. Klientki | Tabela `clients`, lista, wyszukiwanie po imieniu/telefonie, formularz minimalny, wyróżnione alergie | Dodanie klientki w < 20 s; wyszukanie po 3 cyfrach telefonu |
| 3. Katalog preparatów | Tabela `products`, marki/linie z domyślną proporcją, wyszukiwarka z podpowiedziami, import CSV, „Zgłoś brak” | Import `docs/katalog-przyklad.csv`; wpisanie „7.1” pokazuje odcienie |
| 4. Wizyty i receptury | `visits`, `recipes`, `recipe_mixes`, `mix_items`; strefy, gramy, przyciski utleniacza, auto-wyliczenie, „Powtórz ostatnią recepturę” | Receptura 2 mieszanek w < 1 min; powtórzenie poprzedniej jednym kliknięciem |
| 5. Zdjęcia | Aparat w PWA, kompresja, prywatny Storage, `attachments`, oś czasu klientki | Zdjęcie widoczne u innej osoby na innym telefonie |
| 6. Notatki głosowe | Nagrywanie w przeglądarce, upload, transkrypcja przez API, edycja tekstu | Nagranie 30 s zamienia się w tekst po polsku |
| 7. Szkice | Status Szkic/Zakończona, autozapis, zapis lokalny offline + synchronizacja, przypomnienie na koniec dnia | Wizyta zapisana w trybie samolotowym trafia na serwer po powrocie sieci |
| 8. Magazyn | `stock_movements`, odejmowanie zużycia po zakończeniu wizyty, alert niskiego stanu, przyjęcie dostawy | Stan farby maleje o zużyte gramy; alert przy progu |
| 9. Onboarding | Ekran powitalny, klientka testowa, lista startowa, podpowiedzi na pustych ekranach, dymki pierwszego użycia | Nowa osoba zapisuje pierwszą wizytę bez instrukcji |
| 10. Pilotaż | Poprawki UX, wydajność, backupy, domena, dane startowe | Tydzień pracy salonu bez utraty danych |

## Przykładowe polecenie dla agenta

> Przeczytaj docs/SPEC.md, docs/ROADMAP.md i AGENTS.md. Realizujemy Etap 2: Klientki. Najpierw przedstaw plan: migracje, polityki RLS, komponenty i testy. Nie zaczynaj implementacji przed moją akceptacją. Nie usuwaj ani nie zmieniaj istniejących kolumn.

## Wdrożenie krok po kroku (quick guide)

1. Repozytorium GitHub (to repo) z `docs/` i `AGENTS.md`.
2. Dwa projekty Supabase w regionie UE: `staging` i `production`.
3. Agent buduje szkielet Next.js + TypeScript + Tailwind + Supabase z konfiguracją PWA (Etap 0).
4. Schemat bazy jako migracje (Supabase CLI) razem z politykami RLS; najpierw na `staging`.
5. Prywatne buckety Storage na zdjęcia i nagrania.
6. Wyłączona publiczna rejestracja; logowanie e-mail i zaproszenia.
7. Konto Vercel połączone z repozytorium; zmienne środowiskowe (klucze Supabase, klucz API transkrypcji) osobno dla `staging` i `production`.
8. Moduły MVP w kolejności etapów powyżej.
9. Testy każdego modułu na `staging` z danymi testowymi, w tym testy RLS.
10. Automatyczne backupy na `production`; kopia przed pierwszym wdrożeniem.
11. Własna domena w Vercel.
12. Startowy katalog farb i utleniaczy (import z CSV).
13. Zaproszenie uczennic i instalacja aplikacji na ich telefonach.
14. Tydzień pilotażu: uwagi, poprawki na `staging`, wdrożenia na `production`.
