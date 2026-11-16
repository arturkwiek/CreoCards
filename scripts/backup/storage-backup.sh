#!/usr/bin/env bash
# Kopia plików ze Supabase Storage (zdjęcia, nagrania – od Etapu 5): pobranie wszystkich bucketów przez API S3
# Supabase Storage → manifest sum SHA-256 → tar → age → Backblaze B2. Bez bucketów – sukces bez wysyłki.
# Liczba pobranych plików musi się zgadzać z liczbą obiektów w storage.objects (inaczej backup jest czerwony).
#
# Wymagane: DB_URL (lista bucketów), AGE_RECIPIENT, BACKUP_PREFIX, B2_* (bez BACKUP_SKIP_UPLOAD=1); gdy są buckety także
# STORAGE_S3_ENDPOINT, STORAGE_S3_KEY_ID, STORAGE_S3_SECRET (Supabase → Storage → S3 Connection → Access keys)
# i opcjonalnie STORAGE_S3_REGION (domyślnie eu-west-3 – region projektu).
# BACKUP_SKIP_UPLOAD=1 – bez wysyłki (test w CI), plik zostaje w BACKUP_OUT_DIR.
set -euo pipefail
set +x
umask 077

fail() { echo "BŁĄD: $*" >&2; exit 1; }

required=(DB_URL AGE_RECIPIENT BACKUP_PREFIX)
[ "${BACKUP_SKIP_UPLOAD:-0}" = "1" ] || required+=(B2_KEY_ID B2_APPLICATION_KEY B2_BUCKET B2_ENDPOINT)
for name in "${required[@]}"; do
  [ -n "${!name:-}" ] || fail "brak zmiennej $name"
done

mapfile -t BUCKETS < <(psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 -c "select id from storage.buckets order by id")
if [ "${#BUCKETS[@]}" -eq 0 ]; then
  echo "Storage: brak bucketów – kopia plików pominięta (pojawi się wraz ze zdjęciami w Etapie 5)."
  exit 0
fi
for name in STORAGE_S3_ENDPOINT STORAGE_S3_KEY_ID STORAGE_S3_SECRET; do
  [ -n "${!name:-}" ] || fail "są buckety Storage (${#BUCKETS[@]}), ale brak sekretu $name – kopia plików niemożliwa"
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="creocards-${BACKUP_PREFIX}-storage-${STAMP}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/$NAME"

export RCLONE_CONFIG_SUPA_TYPE=s3
export RCLONE_CONFIG_SUPA_PROVIDER=Other
export RCLONE_CONFIG_SUPA_ENDPOINT="$STORAGE_S3_ENDPOINT"
export RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$STORAGE_S3_KEY_ID"
export RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$STORAGE_S3_SECRET"
export RCLONE_CONFIG_SUPA_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_SUPA_REGION="${STORAGE_S3_REGION:-eu-west-3}"

for bucket in "${BUCKETS[@]}"; do
  mkdir -p "$WORK/$NAME/$bucket"
  rclone copy -q "supa:$bucket" "$WORK/$NAME/$bucket"
done
COUNT="$(find "$WORK/$NAME" -type f | wc -l)"
EXPECTED="$(psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 -c "select count(*) from storage.objects")"
# Plik dodany w trakcie kopii może podnieść liczbę plików; brak pliku z bazy = błąd.
[ "$COUNT" -ge "$EXPECTED" ] || fail "pobrano $COUNT plik(ów), a w bazie jest $EXPECTED obiektów – kopia niepełna"

# Manifest: sumy SHA-256 wszystkich plików (sprawdzane przy odszyfrowaniu i po przywróceniu).
(cd "$WORK/$NAME" && find . -type f ! -path ./files.sha256 -print0 | sort -z | xargs -0 -r sha256sum >files.sha256)

tar -C "$WORK" -czf "$WORK/$NAME.tar.gz" "$NAME"
PLAIN_SHA="$(sha256sum "$WORK/$NAME.tar.gz" | cut -d' ' -f1)"
age -r "$AGE_RECIPIENT" -o "$WORK/$NAME.tar.gz.age" "$WORK/$NAME.tar.gz"
ENC_SHA="$(sha256sum "$WORK/$NAME.tar.gz.age" | cut -d' ' -f1)"
printf '%s  %s\n%s  %s\n' "$ENC_SHA" "$NAME.tar.gz.age" "$PLAIN_SHA" "$NAME.tar.gz" >"$WORK/$NAME.sha256"
SIZE="$(stat -c %s "$WORK/$NAME.tar.gz.age")"
echo "Storage: ${#BUCKETS[@]} bucket(y), $COUNT plik(ów), zaszyfrowano $NAME.tar.gz.age ($SIZE B)"

if [ "${BACKUP_SKIP_UPLOAD:-0}" = "1" ]; then
  OUT="${BACKUP_OUT_DIR:?BACKUP_OUT_DIR wymagany przy BACKUP_SKIP_UPLOAD=1}"
  cp "$WORK/$NAME.tar.gz.age" "$WORK/$NAME.sha256" "$OUT/"
  echo "Pominięto wysyłkę (BACKUP_SKIP_UPLOAD=1); plik w $OUT"
  exit 0
fi

export RCLONE_CONFIG_B2_TYPE=s3
export RCLONE_CONFIG_B2_PROVIDER=Other
export RCLONE_CONFIG_B2_ENDPOINT="https://${B2_ENDPOINT#https://}"
export RCLONE_CONFIG_B2_ACCESS_KEY_ID="$B2_KEY_ID"
export RCLONE_CONFIG_B2_SECRET_ACCESS_KEY="$B2_APPLICATION_KEY"
export RCLONE_CONFIG_B2_NO_CHECK_BUCKET=true
DEST="b2:${B2_BUCKET}/${BACKUP_PREFIX}/storage"
rclone copyto -q "$WORK/$NAME.tar.gz.age" "$DEST/$NAME.tar.gz.age"
rclone copyto -q "$WORK/$NAME.sha256" "$DEST/$NAME.sha256"
[ "$(rclone lsf -q --format s "$DEST/$NAME.tar.gz.age")" = "$SIZE" ] || fail "rozmiar w magazynie niezgodny"
echo "Wysłano do B2: ${BACKUP_PREFIX}/storage/$NAME.tar.gz.age – rozmiar zgodny."
