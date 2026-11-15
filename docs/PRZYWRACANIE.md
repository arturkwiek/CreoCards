# CreoCards – runbook przywracania danych

Instrukcja na wypadek utraty lub uszkodzenia danych. Polecenia uruchamiasz w **WSL Ubuntu** w katalogu repozytorium:
`cd /mnt/c/Users/Dell/Desktop/Workplace/Repositories/CreoCards`.

## 0. Co mamy i od czego zacząć

| Problem | Pierwszy krok | Kopia |
|---|---|---|
| Ktoś usunął klientkę, wizytę lub produkt | Aplikacja → **Kosz** → „Przywróć” | nie potrzeba |
| Zła zmiana danych klientki, wizyty lub receptury | Karta klientki / wizyta → **Historia zmian** → „Przywróć tę wersję” | nie potrzeba |
| Utracona lub uszkodzona cała baza (awaria, błąd migracji, przejęte konto) | ten runbook, scenariusz A | nocny backup z B2 |
| Produkcja na Supabase Pro (po założeniu) | najpierw kopia dzienna / PITR w panelu Supabase; gdy niedostępna – ten runbook | Supabase + B2 |

- **Kopie poza Supabase:** co noc o 02:15 / 03:15 czasu polskiego (workflow `Backup` w GitHub Actions). Pliki w Backblaze B2 (EU Central), bucket `creocards-backup-staging`, katalogi `staging/db/` i `staging/storage/`. Przechowywane 30 dni, z blokadą usunięcia (Object Lock).
- **Szyfrowanie:** age. Klucz prywatny jest **tylko u właściciela projektu** (`~/.creocards/backup.agekey`, menedżer haseł i kopia offline). Bez niego kopii nie da się odczytać.
- **RPO (ile danych można stracić):** do 24 godzin – czas od ostatniej nocnej kopii.
- **RTO (czas przywrócenia):** ok. 1–2 godzin, łącznie z założeniem nowego projektu Supabase i przełączeniem Vercel.
- **Po przywróceniu:** konta i hasła działają jak wcześniej, ale wszyscy muszą zalogować się ponownie (nowy projekt ma nowe klucze sesji).

### Co obejmuje kopia danych

Cały schemat `public` oraz z tabel zarządzanych przez Supabase tylko te z `scripts/backup/data-allowlist.txt`: `auth.users`, `auth.identities`, `storage.buckets`, `storage.objects`. Pozostałe (sesje, tokeny, logi Auth, multipart, `storage.buckets_vectors`, `storage.vector_indexes` i inne) to dane wewnętrzne – nowy projekt tworzy je sam, a rola `postgres` często nie ma do nich prawa zapisu. Backup przerywa się, gdy pojawią się dane MFA, passkeys, SSO lub OAuth (tabele z `identity-guard.sql`), żeby nic nie zginęło po cichu. CI przy każdym PR robi kopię lokalnej bazy i przywraca ją na czystej bazie Supabase jako `postgres` bez superusera.

## 1. Przygotowanie (jednorazowo)

```bash
sudo apt update && sudo apt install -y age rclone postgresql-client
ls -l ~/.creocards/backup.agekey   # klucz prywatny musi być na miejscu (z menedżera haseł / kopii offline)
```

Jeśli klucza nie ma w WSL, odtwórz plik z menedżera haseł:

```bash
mkdir -p ~/.creocards && chmod 700 ~/.creocards
nano ~/.creocards/backup.agekey    # wklej zawartość (linia AGE-SECRET-KEY-1…)
chmod 600 ~/.creocards/backup.agekey
```

## 2. Pobranie kopii

Najprościej przez przeglądarkę: backblaze.com → **Buckets** → `creocards-backup-staging` → **Browse Files** → `staging/db/`.
Pobierz **najnowszą parę** plików o tej samej nazwie:

- `creocards-staging-db-RRRRMMDDTGGMMSSZ.tar.gz.age`
- `creocards-staging-db-RRRRMMDDTGGMMSSZ.sha256`

Pliki trafią do katalogu Pobrane w Windows, czyli w WSL do `/mnt/c/Users/Dell/Downloads/`.

## 3. Odszyfrowanie i sprawdzenie (u Ciebie, klucz nie opuszcza komputera)

```bash
bash scripts/backup/decrypt-backup.sh /mnt/c/Users/Dell/Downloads/creocards-staging-db-RRRRMMDDTGGMMSSZ.tar.gz.age
```

Skrypt:
1. sprawdza sumę SHA-256 pliku (plik `.sha256` musi leżeć obok);
2. odszyfrowuje kopię kluczem `~/.creocards/backup.agekey`;
3. rozpakowuje ją do `~/creocards-restore/creocards-staging-db-…/` (`roles.sql`, `schema.sql`, `data.sql`, `manifest.txt`, `row-counts.tsv`);
4. pokazuje datę kopii, listę migracji i liczby wierszy.

> Katalog `~/creocards-restore` zawiera dane klientek (także alergie). Po zakończeniu usuń go (krok 8) i nie kopiuj go nigdzie poza WSL.

## 4. Scenariusz A – przywrócenie do nowego projektu Supabase

1. **Nowy projekt:** supabase.com → New project, region **EU (Paris, eu-west-3)**, mocne hasło bazy zapisane w menedżerze haseł.
2. **Adres bazy:** w nowym projekcie Connect → **Session pooler** (port 5432); podstaw hasło. Zapisz go do zmiennej – nie wklejaj go do plików:
   ```bash
   read -rs TARGET_DB_URL && export TARGET_DB_URL    # wklej adres i Enter (nie będzie widoczny)
   R=~/creocards-restore/creocards-staging-db-RRRRMMDDTGGMMSSZ
   ```
3. **Odtworzenie bazy i porównanie liczby wierszy** – role, schemat i dane w jednej transakcji (przy pierwszym błędzie nic nie zostaje zapisane), potem porównanie z chwilą kopii:
   ```bash
   bash scripts/backup/restore-db.sh "$R"
   ```
   Oczekiwany koniec: `Przywrócono.` i `Liczby wierszy: ZGODNE`. Wynik psql jest w `$R/restore.log` (zawiera tylko komunikaty, nie dane).
4. **Historia migracji** (kopia danych jej nie zawiera) – oznacz migracje z manifestu jako zastosowane, żeby kolejne `db push` nie próbowały ich powtórzyć:
   ```bash
   VERSIONS=$(grep '^migrations=' "$R/manifest.txt" | cut -d= -f2 | tr ',' ' ')
   npx supabase migration repair --status applied $VERSIONS --remote="$TARGET_DB_URL"
   ```
5. **Konta:** kopia zawiera `auth.users` i `auth.identities` (logowanie e-mailem i loginem działa tymi samymi hasłami), ale nie sesje – wszyscy logują się ponownie.

6. **Konfiguracja Auth:** w `supabase/config.toml` w bloku `[remotes.staging]` (albo produkcji) zmień `project_id` na nowy, potem `npx supabase link --project-ref <nowy>`, `npx supabase config diff` i `npx supabase config push`.
7. **Przełączenie aplikacji:** w Vercel podmień `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` (sensitive) na klucze nowego projektu, a w GitHub sekret `STAGING_DB_URL`. Następnie **Redeploy**.
8. **Lista kontrolna**, potem sprzątanie:
   - [ ] logowanie właścicielki (e-mail) i uczennicy (login);
   - [ ] lista klientek; klientka z alergiami ma czerwony blok;
   - [ ] karta klientki: wizyty i skrót receptury zgodne z ostatnim stanem;
   - [ ] katalog i usługi na miejscu;
   - [ ] Kosz i Historia zmian działają;
   - [ ] zdjęcia otwierają się (od Etapu 5, po kroku 5 poniżej);
   - [ ] ręczne uruchomienie workflow `Backup` na nowym projekcie kończy się sukcesem.

   ```bash
   rm -rf ~/creocards-restore
   unset TARGET_DB_URL
   ```

## 5. Pliki Storage (zdjęcia, nagrania – od Etapu 5)

1. Pobierz z B2 najnowszy plik z `staging/storage/` i odszyfruj go tym samym skryptem (krok 3). Pliki trafią do `~/creocards-restore/creocards-staging-storage-…/<bucket>/…`.
2. W nowym projekcie utwórz te same buckety (prywatne) – zrobi to migracja Etapu 5. Wygeneruj klucze S3: Storage → S3 Connection → New access key.
3. Wyślij pliki (wartości podaj z klawiatury, nie zapisuj ich w plikach):
   ```bash
   read -r  STORAGE_S3_ENDPOINT && read -r STORAGE_S3_KEY_ID && read -rs STORAGE_S3_SECRET
   export RCLONE_CONFIG_SUPA_TYPE=s3 RCLONE_CONFIG_SUPA_PROVIDER=Other RCLONE_CONFIG_SUPA_FORCE_PATH_STYLE=true \
     RCLONE_CONFIG_SUPA_ENDPOINT="$STORAGE_S3_ENDPOINT" RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$STORAGE_S3_KEY_ID" \
     RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$STORAGE_S3_SECRET"
   S=~/creocards-restore/creocards-staging-storage-RRRRMMDDTGGMMSSZ
   for b in "$S"/*/; do rclone copy "$b" "supa:$(basename "$b")"; done
   ```

## 6. Próba przywrócenia (kryterium akceptacji Etapu 4a, potem raz na kwartał)

Próba odtwarza scenariusz A na **tymczasowym projekcie** `creocards-restore-test` (plan Free, region EU), żeby nie nadpisywać działającego stagingu:

1. Uruchom ręcznie workflow `Backup` (GitHub → Actions → Backup → Run workflow) i poczekaj na zielony status.
2. Kroki 2–5 i 8 (bez kroków 6–7: aplikacja zostaje na dotychczasowym stagingu). Zmierz czas od pobrania pliku do „Liczby wierszy: ZGODNE”.
3. Opcjonalnie podłącz lokalnie aplikację do projektu próbnego (`.env.local` z jego kluczami) i przejdź listę kontrolną.
4. Usuń projekt próbny w panelu Supabase (Settings → General → Delete project) i katalog `~/creocards-restore`.
5. Zapisz wynik w `docs/PRZEBIEG-PROJEKTU.md`: data, nazwa kopii, czas przywrócenia, ewentualne problemy.

## 7. Gdy coś nie działa

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| `suma SHA-256 … się nie zgadza` | plik pobrał się niecały – pobierz ponownie albo weź kopię z poprzedniej nocy |
| `age: no identity matched any of the recipients` | zły klucz – kopia zaszyfrowana innym kluczem publicznym (sprawdź `AGE_RECIPIENT` w GitHub) |
| `psql: … role "…" already exists` przy `roles.sql` | na nowym projekcie role Supabase już są – to ostrzeżenie; jeśli przerywa transakcję, usuń z `roles.sql` linie `CREATE ROLE` dla istniejących ról i powtórz krok 3 |
| `permission denied for table …` przy `data.sql` | kopia zawiera tabelę wewnętrzną Supabase – zrób nową kopię aktualnym skryptem (lista dozwolonych tabel); stare kopie sprzed poprawki przywracaj po usunięciu z `data.sql` bloków `COPY` dla tej tabeli |
| `relation … already exists` | projekt docelowy nie był pusty – użyj nowego, pustego projektu |
| Workflow `Backup` czerwony | GitHub → Actions → Backup → log kroku; najczęściej wygasły sekret (`STAGING_DB_URL`, `B2_*`) – ustaw go ponownie `gh secret set … --repo arturkwiek/CreoCards` |
