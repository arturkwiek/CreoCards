#!/usr/bin/env bash
# Przywrócenie odszyfrowanej kopii do PUSTEGO projektu Supabase (docs/PRZYWRACANIE.md §4) i porównanie liczby wierszy.
#   TARGET_DB_URL=… bash scripts/backup/restore-db.sh ~/creocards-restore/creocards-staging-db-…
# Łączy się jako zwykła rola postgres (bez superusera) – tak jak na nowym projekcie.
# Role, schemat i dane w jednej transakcji: przy pierwszym błędzie nic nie zostaje zapisane.
# Skrypt nie wypisuje danych; wynik psql trafia do pliku logu w katalogu kopii.
set -euo pipefail
umask 077

fail() { echo "BŁĄD: $*" >&2; exit 1; }

R="${1:?Podaj katalog odszyfrowanej kopii}"
: "${TARGET_DB_URL:?Ustaw TARGET_DB_URL (adres pustego projektu docelowego)}"
HERE="$(cd "$(dirname "$0")" && pwd)"
for f in roles.sql schema.sql data.sql row-counts.tsv; do
  [ -s "$R/$f" ] || fail "w kopii brak pliku $f"
done

LOG="$R/restore.log"
echo "Przywracanie role + schemat + dane (jedna transakcja)…"
if ! psql "$TARGET_DB_URL" -X --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$R/roles.sql" \
  --file "$R/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$R/data.sql" >"$LOG" 2>&1; then
  grep -E 'ERROR|FATAL' "$LOG" | head -5 >&2
  fail "przywracanie przerwane – transakcja wycofana, baza docelowa bez zmian (log: $LOG)"
fi
echo "Przywrócono."

if psql "$TARGET_DB_URL" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 -f "$HERE/row-counts.sql" | diff - "$R/row-counts.tsv"; then
  echo "Liczby wierszy: ZGODNE"
else
  fail "liczby wierszy różnią się od kopii (powyżej: < baza docelowa, > kopia)"
fi
