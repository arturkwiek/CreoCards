#!/usr/bin/env bash
# Nocny backup bazy poza Supabase: supabase db dump (role, schemat, dane – w tym konta z auth)
# → tar.gz → szyfrowanie age (klucz publiczny; prywatny tylko u właściciela projektu) → Backblaze B2 (UE).
# Retencję (30 dni) i blokadę usuwania (Object Lock) ustawia bucket. Instrukcja przywracania: docs/PRZYWRACANIE.md.
#
# Wymagane zmienne: DB_URL, AGE_RECIPIENT, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT, BACKUP_PREFIX.
# BACKUP_SKIP_UPLOAD=1 – tylko zrzut i szyfrowanie (test lokalny), plik zostaje w BACKUP_OUT_DIR.
# Skrypt niczego nie wypisuje z danych ani sekretów.
set -euo pipefail
set +x
umask 077

fail() { echo "BŁĄD: $*" >&2; exit 1; }

required=(DB_URL AGE_RECIPIENT BACKUP_PREFIX)
[ "${BACKUP_SKIP_UPLOAD:-0}" = "1" ] || required+=(B2_KEY_ID B2_APPLICATION_KEY B2_BUCKET B2_ENDPOINT)
for name in "${required[@]}"; do
  [ -n "${!name:-}" ] || fail "brak zmiennej $name (sekret/zmienna repozytorium w GitHub Actions)"
done
[[ "$AGE_RECIPIENT" == age1* ]] || fail "AGE_RECIPIENT nie wygląda na klucz publiczny age (age1…)"
[[ "$BACKUP_PREFIX" =~ ^[a-z0-9-]+$ ]] || fail "BACKUP_PREFIX: tylko małe litery, cyfry i myślnik"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="creocards-${BACKUP_PREFIX}-db-${STAMP}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DIR="$WORK/$NAME"
mkdir -p "$DIR"
HERE="$(cd "$(dirname "$0")" && pwd)"
ALLOW="$(grep -vE '^\s*(#|$)' "$HERE/data-allowlist.txt" | paste -sd, -)"

echo "Zrzut bazy (${BACKUP_PREFIX})…"
npx supabase db dump --remote="$DB_URL" --role-only -f "$DIR/roles.sql" >/dev/null
npx supabase db dump --remote="$DB_URL" -f "$DIR/schema.sql" >/dev/null
# Dane: cały schemat public + lista dozwolonych tabel zarządzanych przez Supabase (data-allowlist.txt).
# Pozostałe tabele auth/storage/… (sesje, tokeny, logi, kolejki, buckets_vectors, vector_indexes itd.)
# są wewnętrzne – na nowym projekcie rola postgres często nie ma do nich prawa zapisu, a Supabase odtwarza je sam.
# Lista budowana z bazy przy każdym zrzucie, więc nowe tabele Supabase są pomijane automatycznie.
EXCLUDE="$(psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 -v allow="$ALLOW" -f "$HERE/data-excluded.sql" | paste -sd, -)"
# Zabezpieczenie: dane tożsamości, których kopia nie obejmuje (MFA, SSO, OAuth) – jeśli się pojawią, backup ma się nie udać.
LOST="$(psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 -f "$HERE/identity-guard.sql")"
[ -z "$LOST" ] || fail "tabele z danymi tożsamości spoza kopii nie są puste: $LOST – dopisz je do data-allowlist.txt i sprawdź przywracanie"
npx supabase db dump --remote="$DB_URL" --data-only --use-copy ${EXCLUDE:+--exclude "$EXCLUDE"} -f "$DIR/data.sql" >/dev/null

for f in roles.sql schema.sql data.sql; do
  [ -s "$DIR/$f" ] || fail "pusty plik $f"
done
grep -q 'CREATE TABLE "public"."clients"\|CREATE TABLE IF NOT EXISTS "public"."clients"' "$DIR/schema.sql" || fail "schemat bez tabeli clients"
grep -q 'COPY "auth"."users"' "$DIR/data.sql" || fail "dane bez kont (auth.users)"
grep -q 'COPY "public"."clients"' "$DIR/data.sql" || fail "dane bez tabeli clients"
for t in '"storage"."buckets"' '"storage"."objects"' '"auth"."identities"'; do
  grep -q "COPY $t" "$DIR/data.sql" || fail "dane bez tabeli $t"
done
# Żadna tabela spoza public i listy dozwolonych nie może trafić do danych.
EXTRA="$(grep -oE '^COPY "[a-z_]+"\."[a-z_]+"' "$DIR/data.sql" | sed -E 's/^COPY "([a-z_]+)"\."([a-z_]+)"/\1.\2/' \
  | grep -v '^public\.' | grep -vxF -f <(tr , '\n' <<<"$ALLOW") || true)"
[ -z "$EXTRA" ] || fail "w danych tabele spoza listy dozwolonych: $(paste -sd' ' <<<"$EXTRA")"

# Polityki Storage (zrzut schematu ich nie obejmuje) – odtwarzane przez restore-db.sh.
psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 -f "$HERE/storage-policies.sql" >"$DIR/storage-policies.sql"

# Liczby wierszy – do porównania po przywróceniu (bez danych osobowych).
psql "$DB_URL" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 -f "$HERE/row-counts.sql" >"$DIR/row-counts.tsv"

{
  echo "created_at=$STAMP"
  echo "prefix=$BACKUP_PREFIX"
  echo "git_commit=${GITHUB_SHA:-local}"
  echo "migrations=$(ls supabase/migrations/*.sql 2>/dev/null | xargs -n1 basename | sed 's/_.*//' | paste -sd, -)"
  echo "supabase_cli=$(npx supabase --version 2>/dev/null | head -1)"
} >"$DIR/manifest.txt"

tar -C "$WORK" -czf "$WORK/$NAME.tar.gz" "$NAME"
PLAIN_SHA="$(sha256sum "$WORK/$NAME.tar.gz" | cut -d' ' -f1)"
age -r "$AGE_RECIPIENT" -o "$WORK/$NAME.tar.gz.age" "$WORK/$NAME.tar.gz"
ENC_SHA="$(sha256sum "$WORK/$NAME.tar.gz.age" | cut -d' ' -f1)"
printf '%s  %s\n%s  %s\n' "$ENC_SHA" "$NAME.tar.gz.age" "$PLAIN_SHA" "$NAME.tar.gz" >"$WORK/$NAME.sha256"
SIZE="$(stat -c %s "$WORK/$NAME.tar.gz.age")"
echo "Zaszyfrowano: $NAME.tar.gz.age ($SIZE B)"

if [ "${BACKUP_SKIP_UPLOAD:-0}" = "1" ]; then
  OUT="${BACKUP_OUT_DIR:?BACKUP_OUT_DIR wymagany przy BACKUP_SKIP_UPLOAD=1}"
  cp "$WORK/$NAME.tar.gz.age" "$WORK/$NAME.sha256" "$OUT/"
  echo "Pominięto wysyłkę (BACKUP_SKIP_UPLOAD=1); plik w $OUT"
  exit 0
fi

# Backblaze B2 przez API S3 (klucz z dostępem tylko do bucketu backupów).
export RCLONE_CONFIG_B2_TYPE=s3
export RCLONE_CONFIG_B2_PROVIDER=Other
export RCLONE_CONFIG_B2_ENDPOINT="https://${B2_ENDPOINT#https://}"
export RCLONE_CONFIG_B2_ACCESS_KEY_ID="$B2_KEY_ID"
export RCLONE_CONFIG_B2_SECRET_ACCESS_KEY="$B2_APPLICATION_KEY"
export RCLONE_CONFIG_B2_NO_CHECK_BUCKET=true

DEST="b2:${B2_BUCKET}/${BACKUP_PREFIX}/db"
rclone copyto -q "$WORK/$NAME.tar.gz.age" "$DEST/$NAME.tar.gz.age"
rclone copyto -q "$WORK/$NAME.sha256" "$DEST/$NAME.sha256"

REMOTE_SIZE="$(rclone lsf -q --format s "$DEST/$NAME.tar.gz.age")"
[ "$REMOTE_SIZE" = "$SIZE" ] || fail "rozmiar w magazynie ($REMOTE_SIZE) różny od lokalnego ($SIZE)"
echo "Wysłano do B2: ${BACKUP_PREFIX}/db/$NAME.tar.gz.age – rozmiar zgodny."
