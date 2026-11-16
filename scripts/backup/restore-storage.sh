#!/usr/bin/env bash
# Przywrócenie plików Storage z odszyfrowanej kopii (docs/PRZYWRACANIE.md §5) i sprawdzenie zawartości.
#   STORAGE_S3_ENDPOINT=… STORAGE_S3_KEY_ID=… STORAGE_S3_SECRET=… [STORAGE_S3_REGION=eu-west-3] \
#     bash scripts/backup/restore-storage.sh ~/creocards-restore/creocards-staging-storage-…
# Najpierw przywróć bazę (restore-db.sh) – kopia bazy zawiera buckety i wpisy storage.objects, a ten skrypt
# wysyła same pliki. Wysyła wszystkie pliki bez porównywania z tym, co jest w Storage (--ignore-times):
# po przywróceniu bazy Storage „zna” obiekty z wpisów, ale plików jeszcze nie ma.
# Na koniec rclone pobiera każdy plik i porównuje z kopią, a jedno zdjęcie jest sprawdzane sumą SHA-256.
set -euo pipefail
set +x
umask 077

fail() { echo "BŁĄD: $*" >&2; exit 1; }

S="${1:?Podaj katalog odszyfrowanej kopii plików Storage}"
for name in STORAGE_S3_ENDPOINT STORAGE_S3_KEY_ID STORAGE_S3_SECRET; do
  [ -n "${!name:-}" ] || fail "brak zmiennej $name (Supabase → Storage → S3 Connection projektu docelowego)"
done
[ -s "$S/files.sha256" ] || fail "w katalogu brak manifestu files.sha256 – to nie jest kopia plików Storage"
command -v rclone >/dev/null || fail "zainstaluj rclone: sudo apt install -y rclone"

export RCLONE_CONFIG_SUPA_TYPE=s3
export RCLONE_CONFIG_SUPA_PROVIDER=Other
export RCLONE_CONFIG_SUPA_ENDPOINT="$STORAGE_S3_ENDPOINT"
export RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$STORAGE_S3_KEY_ID"
export RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$STORAGE_S3_SECRET"
export RCLONE_CONFIG_SUPA_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_SUPA_REGION="${STORAGE_S3_REGION:-eu-west-3}"

TOTAL=0
for dir in "$S"/*/; do
  [ -d "$dir" ] || continue
  bucket="$(basename "$dir")"
  n="$(find "$dir" -type f | wc -l)"
  [ "$n" -gt 0 ] || continue
  echo "Wysyłanie: $bucket ($n plik(ów))…"
  rclone copy -q --ignore-times --s3-no-check-bucket "$dir" "supa:$bucket"
  # Treść każdego pliku: pobranie z Storage i porównanie bajt po bajcie z kopią.
  rclone check -q --one-way --download "$dir" "supa:$bucket" || fail "pliki w buckecie $bucket różnią się od kopii"
  TOTAL=$((TOTAL + n))
done
[ "$TOTAL" -eq "$(wc -l <"$S/files.sha256")" ] || fail "liczba plików różni się od manifestu kopii"

# Jedno zdjęcie: pobranie z Storage i suma SHA-256 z manifestu (kryterium próby przywrócenia).
SAMPLE="$(grep -m1 -E ' \./photos/.+[^m]\.(webp|jpg)$' "$S/files.sha256" || head -1 "$S/files.sha256")"
SUM="${SAMPLE%% *}"
REL="${SAMPLE#*  ./}"
GOT="$(rclone cat "supa:$REL" | sha256sum | cut -d' ' -f1)"
[ "$GOT" = "$SUM" ] || fail "zdjęcie kontrolne różni się od kopii"
echo "Zdjęcie kontrolne: suma SHA-256 zgodna."
if [[ "$REL" == photos/*/*/* ]]; then
  VISIT="$(cut -d/ -f3 <<<"$REL")"
  echo "Otwórz je w aplikacji: /wizyty/$VISIT (sekcja Zdjęcia)."
fi
echo "Przywrócono pliki Storage: $TOTAL – ZGODNE z kopią."
