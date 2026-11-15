# CreoCards – wytyczne funkcjonalne (MVP)

Aplikacja dla studia fryzur **Creo**.

## Cel

Aplikacja do zarządzania bazą klientek, historią wizyt oraz recepturami koloryzacji (farby, utleniacze, proporcje) w małym salonie fryzjerskim. Priorytet: **minimalny czas wprowadzania danych** podczas pracy.

## Użytkownicy i role

- Salon z 3 osobami: fryzjerka (jednocześnie właścicielka) oraz 2 uczennice. Każda osoba ma własne konto.
- Wspólny magazyn preparatów i wspólna baza klientek.
- Każdy wpis (wizyta, receptura) zapisuje autora automatycznie.
- Role:
  - **Właścicielka** – pełne uprawnienia, zarządzanie katalogiem preparatów i kontami.
  - **Uczennica** – zapis klientek, wizyt i receptur; bez edycji katalogu i kont. W kolejnych etapach: akceptacja receptur uczennic przez właścicielkę.

## Rekord klientki (minimalny)

Pola obowiązkowe:

- Imię i nazwisko
- Telefon
- Alergie / uwagi zdrowotne (wyraźnie wyróżnione pole)

Pola opcjonalne:

- E-mail
- Zgody (RODO, powiadomienia)
- Jedna swobodna notatka (profil włosa, preferencje)

Zasada: wszystko poza polami obowiązkowymi uzupełnia się przy okazji, nigdy nie blokuje zapisu.

## Wizyta

- Data i osoba wykonująca zapisują się automatycznie.
- Usługa wybierana z listy.
- Receptura (opcjonalna, patrz niżej).
- Zdjęcia gotowej fryzury (jedno lub więcej).
- Notatka głosowa z automatyczną transkrypcją na tekst.
- Status: **Szkic** lub **Zakończona**.

## Receptura koloryzacji

Receptura należy do wizyty, nie do klientki. Składa się z jednej lub kilku mieszanek.

Każda mieszanka:

- **Strefa** – wybór z listy: odrost, długości, końce, pasemka, inne.
- **Farby** – jedna lub więcej pozycji: produkt z katalogu + ilość w gramach.
- **Utleniacz** – stężenie (przyciski: 3%, 6%, 9%, 12%) + proporcja (przyciski: 1:1, 1:1,5, 1:2, własna). Gramy utleniacza wyliczane automatycznie.
- **Czas trzymania** w minutach.

Do całej receptury: jedna krótka notatka.

Usprawnienia:

- Przycisk **„Powtórz ostatnią recepturę”** – kopiuje recepturę z poprzedniej wizyty do edycji.
- Szybkie wartości gramów (np. 30 / 60 / 90 g) oraz przyciski +/-.

## Katalog preparatów

- Produkty dodawane raz, potem dostępne na liście.
- Pola produktu: marka, linia, numer odcienia / stężenie, typ (farba / utleniacz / rozjaśniacz / toner / inny), pojemność opakowania (g lub ml – jedno pole), cena zakupu (pod przyszłe finanse; widoczna tylko dla właścicielki).
- Wyszukiwanie z podpowiedziami (np. wpisanie „7.1” pokazuje pasujące odcienie).
- Najczęściej używane produkty na górze listy.
- Każda marka/linia może mieć **domyślną proporcję utleniacza**, podpowiadaną automatycznie; produkt może mieć własną proporcję, która ją nadpisuje.
- Import katalogu z CSV (przykłady: `docs/katalog-przyklad.csv` i `docs/katalog-przyklad-arkusz.csv` – eksport arkusza katalogu z polskimi nagłówkami: „Marka”, „Linia”, „Odcień / stężenie”, „Typ”, „Domyślna proporcja”, „Pojemność opakowania (g/ml)”, „Cena zakupu (zł)”, „Uwagi”). Kolumny w dowolnej kolejności, „Uwagi” pomijane; proporcja „inna (w uwagach)” lub pusta = brak proporcji. Podgląd zmian przed zapisem; ponowny import aktualizuje wypełnione pola.

## Magazyn

- Zużyte gramy odejmowane automatycznie po zakończeniu wizyty.
- Ostrzeżenie o niskim stanie produktu.
- Przyjęcie dostawy (zwiększenie stanu).

## Szkice i przypomnienia

- Wizyta może zostać zapisana jako szkic (np. tylko zdjęcie i notatka głosowa).
- Na koniec dnia przypomnienie dla autorki wizyty o nieukończonych szkicach.

## Oś czasu klientki

- Chronologiczny widok wizyt z miniaturami zdjęć i skrótem receptury.

## Wyszukiwanie

- Po imieniu, nazwisku lub fragmencie numeru telefonu.

## Forma aplikacji i stos technologiczny

Aplikacja webowa typu **PWA** (instalowalna na telefonie i tablecie, dostęp do aparatu i mikrofonu, bez publikacji w sklepach). Aplikacja natywna – ewentualnie w przyszłości.

| Warstwa | Technologia |
| --- | --- |
| Frontend | Next.js (React), TypeScript, Tailwind CSS |
| Backend, baza, logowanie | Supabase (PostgreSQL, Auth, Storage) |
| Zdjęcia i nagrania | Supabase Storage (prywatne buckety) |
| Transkrypcja notatek głosowych | API speech-to-text, np. OpenAI Whisper |
| Hosting i CI | Vercel + repozytorium GitHub |

## Przechowywanie danych i bezpieczeństwo

Dane trzymane centralnie w chmurze, więc każda osoba z zespołu na każdym urządzeniu widzi ten sam, aktualny stan.

- **Format**: relacyjna baza PostgreSQL. Główne tabele: `salons`, `users`, `clients`, `visits`, `recipes`, `recipe_mixes`, `mix_items`, `products`, `stock_movements`, `attachments`.
- **Pliki** (zdjęcia, nagrania) w prywatnym Storage; w bazie tylko odnośnik. Dostęp przez krótkotrwałe podpisane linki.
- **Logowanie**: indywidualne konto każdej osoby (login lub e-mail + hasło), bez kont współdzielonych.
- **Kontrola dostępu**: Row Level Security – użytkownik widzi wyłącznie dane swojego salonu (`salon_id` w każdej tabeli). Przygotowane pod wiele salonów w przyszłości.
- **Szyfrowanie**: HTTPS w transmisji, szyfrowanie danych w spoczynku po stronie dostawcy.
- **Audyt**: pola `created_by`, `created_at`, `updated_at` w każdym rekordzie; miękkie usuwanie (`deleted_at`) zamiast trwałego.
- **Kopie zapasowe**: automatyczne backupy bazy (dzienne) oraz okresowy eksport do CSV/JSON.
- **RODO**: dane zdrowotne (alergie) traktowane jako wrażliwe; zapis zgody klientki; możliwość eksportu i usunięcia danych klientki na żądanie; serwery w regionie UE.
- **Praca offline**: szkic wizyty zapisywany lokalnie i synchronizowany po odzyskaniu połączenia.
- **Współdzielenie**: wszystkie dane salonu wspólne dla zespołu; eksport historii klientki do PDF w przyszłych etapach.

## Bezpieczne wdrażanie i ochrona danych

Największe ryzyko to utrata danych przy zmianach struktury bazy przez agenta AI. Szczegółowe reguły: `AGENTS.md`.

1. **Migracje w repozytorium** – każda zmiana schematu jako plik migracji (Supabase CLI); zakaz ręcznych zmian w panelu produkcyjnym.
2. **Dwa środowiska** – osobny projekt Supabase testowy (`staging`) i produkcyjny (`production`).
3. **Kopia przed migracją** – backup bazy przed każdym wdrożeniem; docelowo Point-in-Time Recovery.
4. **Migracje tylko addytywne** – usuwanie, zmiana nazw lub typów kolumn tylko za wyraźną zgodą właściciela projektu.
5. **Miękkie usuwanie** – `deleted_at` zamiast `DELETE`.
6. **Szkice odporne na awarie** – zapis natychmiastowy na serwerze i lokalnie w urządzeniu.
7. **Testy RLS** – automatyczne testy, że użytkownik nie widzi danych innego salonu.

## Dostęp i dystrybucja

Jedna instancja aplikacji w chmurze (Vercel + Supabase); nikt nie przechowuje lokalnej kopii aplikacji ani danych.

- Aplikacja dostępna pod własną domeną.
- Instalacja na telefonie: otwarcie adresu w przeglądarce → logowanie → „Dodaj do ekranu głównego” (PWA).
- Aktualizacje automatyczne: nowa wersja ładuje się przy kolejnym otwarciu aplikacji.
- **Konta zakłada właścicielka** (sekcja Zespół): login (unikalny w salonie; małe litery, cyfry, kropka, myślnik; 3–30 znaków) + rola, e-mail opcjonalny. Publiczna rejestracja wyłączona.
  - Konto bez e-maila ma niewidoczny adres techniczny `<login>.<salon>@konta.creocards.studiocreotarnow.pl` (subdomena bez MX, nic nie jest wysyłane).
  - Pierwsze hasło i reset: jednorazowy link do ustawienia hasła (z przyciskiem „Kontynuuj”, do przekazania np. SMS-em) albo hasło tymczasowe z wymuszoną zmianą przy pierwszym logowaniu.
  - Istniejącym kontom z e-mailem można nadać login; właścicielki logują się prawdziwym e-mailem.
- **Logowanie**: jedno pole „Login lub e-mail” + hasło. Limit nieudanych prób (5 na login, 20 na IP w 15 minut); komunikat nie zdradza, czy login istnieje.
- **E-maile (zaproszenia, reset hasła)**: własny SMTP (Resend) z domeną wysyłkową `mail.studiocreotarnow.pl` – **opcjonalny** (odzyskiwanie konta właścicielki e-mailem); nie jest warunkiem pilotażu.
- Utrata telefonu: wylogowanie wszystkich sesji i reset hasła z poziomu konta właścicielki.

## Wprowadzenie wbudowane w aplikację (MVP)

- Ekran powitalny z 3 krótkimi slajdami zamiast instrukcji do czytania.
- Klientka testowa „Anna Przykładowa” z gotową przykładową wizytą i recepturą.
- Lista startowa z paskiem postępu: zainstaluj, dodaj klientkę, zapisz wizytę, zrób zdjęcie.
- Podpowiedzi na pustych ekranach, np. „Dodaj pierwszą klientkę – zajmie 20 sekund”.
- Dymki przy pierwszym użyciu przycisków „Powtórz ostatnią” i notatki głosowej; później się nie pokazują.
- Przycisk „Zgłoś brak” dla uczennic (brakująca farba w katalogu → powiadomienie właścicielki).
- Import starych receptur zdjęciem kartki z zeszytu, dołączanym do pierwszej wizyty klientki.

Przewodnik dla zespołu: `docs/PRZEWODNIK.md`.

## Przyszłe etapy (poza MVP, ale uwzględnione w modelu danych)

- **Finanse**: cena usługi i koszt materiałów zapisywane od początku; raporty, rentowność usług i rozliczenia później.
- Rozszerzone uprawnienia właścicielki, akceptacja receptur uczennic.
- Wspólny kalendarz wizyt.
- Przypomnienia o teście uczuleniowym.
- Szablony usług.
- Eksport historii klientki do PDF.
- Rozpoznawanie receptury z notatki głosowej (automatyczne uzupełnianie farb i proporcji).

## Zasady projektowe

1. Minimum pól obowiązkowych.
2. Wybór z listy zamiast pisania.
3. Nic nie blokuje zapisu – zawsze można dokończyć później.
4. Dane zbierane od początku z myślą o przyszłych raportach.
