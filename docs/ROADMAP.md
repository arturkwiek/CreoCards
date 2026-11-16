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
| 1b. Loginy | Konta bez e-maila: login (unikalny w salonie) + rola, e-mail opcjonalny; konto przez admin API z adresem technicznym `<login>.<salon>@konta.creocards.studiocreotarnow.pl` (bez wysyłki); logowanie „Login lub e-mail”; pierwsze hasło i reset linkiem z „Kontynuuj” albo hasłem tymczasowym (wymuszona zmiana); limit nieudanych prób na login i IP | Konto założone loginem, logowanie loginem, reset linkiem; login unikalny w salonie; komunikat logowania nie zdradza, czy login istnieje; uczennica bez dostępu do Zespołu |
| 2. Klientki | Tabela `clients`, lista, wyszukiwanie po imieniu/telefonie, formularz minimalny, wyróżnione alergie | Dodanie klientki w < 20 s; wyszukanie po 3 cyfrach telefonu |
| 3. Katalog preparatów | Tabela `products`, marki/linie z domyślną proporcją, wyszukiwarka z podpowiedziami, import CSV, „Zgłoś brak” | Import `docs/katalog-przyklad.csv` (i arkusza z polskimi nagłówkami); wpisanie „7.1” pokazuje odcienie |
| 4. Wizyty i receptury | `visits`, `recipes`, `recipe_mixes`, `mix_items`; strefy, gramy, przyciski utleniacza, auto-wyliczenie, „Powtórz ostatnią recepturę”; lista usług z zakładki „Usługi” arkusza katalogu Kingi (usługa, cena od–do, czas, „Z farbą?”) | Receptura 2 mieszanek w < 1 min; powtórzenie poprzedniej jednym kliknięciem |
| 4a. Bezpieczeństwo danych | Kosz właścicielki (usunięte klientki, wizyty, produkty – podgląd i przywracanie); historia zmian (audyt: poprzednia wersja wiersza, kto, kiedy) dla `clients`, `visits`, `recipes`, `recipe_mixes`, `mix_items` z przywracaniem wersji przez właścicielkę; „Eksportuj dane” (całość CSV/XLSX, dane jednej klientki – RODO); nocny zaszyfrowany backup poza Supabase (baza + pliki Storage, magazyn w UE, retencja 30 dni); runbook przywracania w `docs/` | Przywrócenie usuniętej klientki i poprzedniej wersji receptury; eksport danych klientki; **udana próba przywrócenia backupu na stagingu według runbooka** |
| 5. Zdjęcia | Aparat w PWA, kompresja na telefonie (1600 px, WebP/JPEG), usuwanie EXIF/GPS, prywatny Storage z izolacją salonów i podpisanymi linkami, `attachments`, zgoda na wizerunek (ostrzeżenie, lista „Zdjęcia bez zgody”), Kosz, oś czasu klientki, eksport RODO ze zdjęciami, kopia plików w nocnym backupie | Zdjęcie widoczne u innej osoby na innym telefonie; pobrany plik bez GPS/EXIF; zdjęcie w nocnym backupie i odtworzone w próbie przywrócenia |
| 6. Notatki głosowe | Nagrywanie w przeglądarce, upload, transkrypcja przez API, edycja tekstu | Nagranie 30 s zamienia się w tekst po polsku |
| 7. Szkice | Status Szkic/Zakończona, autozapis, zapis lokalny offline + synchronizacja, przypomnienie na koniec dnia | Wizyta zapisana w trybie samolotowym trafia na serwer po powrocie sieci |
| 8. Magazyn | `stock_movements`, odejmowanie zużycia po zakończeniu wizyty, alert niskiego stanu, przyjęcie dostawy | Stan farby maleje o zużyte gramy; alert przy progu |
| 9. Onboarding | Ekran powitalny, klientka testowa, lista startowa, podpowiedzi na pustych ekranach, dymki pierwszego użycia | Nowa osoba zapisuje pierwszą wizytę bez instrukcji |
| 10. Pilotaż | Poprawki UX, wydajność, backupy, domena, dane startowe; **warunek wstępny: produkcja na Supabase Pro (kopie dzienne, 7 dni) i udana próba przywrócenia**. SMTP Resend z domeną `mail.studiocreotarnow.pl` – opcjonalnie (odzyskiwanie konta właścicielki e-mailem); uczennice logują się loginem | Tydzień pracy salonu bez utraty danych |

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
    - Opcjonalnie (odzyskiwanie konta właścicielki e-mailem): domena wysyłkowa `mail.studiocreotarnow.pl` zweryfikowana w Resend i SMTP włączony w `supabase/config.toml` (instrukcja: `docs/WDROZENIE-STAGING.md`, sekcja 6). Od Etapu 1b nie jest to warunek pilotażu.
12. Startowy katalog farb i utleniaczy (import z CSV).
13. Zaproszenie uczennic i instalacja aplikacji na ich telefonach.
14. Tydzień pilotażu: uwagi, poprawki na `staging`, wdrożenia na `production`.
