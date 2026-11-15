#!/usr/bin/env bash
# Kopia plików ze Supabase Storage (zdjęcia, nagrania – od Etapu 5): pobranie wszystkich bucketów przez API S3
# Supabase Storage → tar → age → Backblaze B2. Bez bucketów – kończy się sukcesem bez wysyłki.
#
# Wymagane: DB_URL (lista bucketów), AGE_RECIPIENT, B2_*, BACKUP_PREFIX; gdy są buckety także
# STORAGE_S3_ENDPOINT, STORAGE_S3_KEY_ID, STORAGE_S3_SECRET (Supabase → Storage → S3 Connection → Access keys).
set -euo pipefail
set +x
umask 077

fail() { echo "BŁĄD: $*" >&2; exit 1; }

for name in DB_URL AGE_RECIPIENT BACKUP_PREFIX B2_KEY_ID B2_APPLICATION_KEY B2_BUCKET B2_ENDPOINT; do
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

for bucket in "${BUCKETS[@]}"; do
  rclone copy -q "supa:$bucket" "$WORK/$NAME/$bucket"
done
COUNT="$(find "$WORK/$NAME" -type f | wc -l)"

tar -C "$WORK" -czf "$WORK/$NAME.tar.gz" "$NAME"
age -r "$AGE_RECIPIENT" -o "$WORK/$NAME.tar.gz.age" "$WORK/$NAME.tar.gz"
sha256sum "$WORK/$NAME.tar.gz.age" | sed "s#  .*#  $NAME.tar.gz.age#" >"$WORK/$NAME.sha256"
SIZE="$(stat -c %s "$WORK/$NAME.tar.gz.age")"

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
echo "Storage: ${#BUCKETS[@]} bucket(y), $COUNT plik(ów) → ${BACKUP_PREFIX}/storage/$NAME.tar.gz.age"
