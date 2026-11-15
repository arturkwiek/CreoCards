#!/usr/bin/env bash
# Odszyfrowanie i sprawdzenie kopii (WSL, u właściciela klucza – klucz prywatny nie opuszcza komputera).
#   bash scripts/backup/decrypt-backup.sh <plik.tar.gz.age> [klucz=~/.creocards/backup.agekey] [katalog=~/creocards-restore]
# Sprawdza sumę SHA-256 (gdy obok leży plik .sha256), odszyfrowuje, rozpakowuje i pokazuje manifest oraz liczby wierszy.
set -euo pipefail
umask 077

fail() { echo "BŁĄD: $*" >&2; exit 1; }

FILE="${1:?Podaj plik .tar.gz.age}"
KEY="${2:-$HOME/.creocards/backup.agekey}"
OUT="${3:-$HOME/creocards-restore}"
[ -f "$FILE" ] || fail "brak pliku $FILE"
[ -f "$KEY" ] || fail "brak klucza $KEY"
command -v age >/dev/null || fail "zainstaluj age: sudo apt install -y age"

BASE="$(basename "$FILE" .tar.gz.age)"
SUMS="$(dirname "$FILE")/$BASE.sha256"
if [ -f "$SUMS" ]; then
  expected="$(grep " $BASE.tar.gz.age\$" "$SUMS" | cut -d' ' -f1)"
  actual="$(sha256sum "$FILE" | cut -d' ' -f1)"
  [ "$expected" = "$actual" ] || fail "suma SHA-256 pliku zaszyfrowanego się nie zgadza – plik uszkodzony"
  echo "Suma SHA-256 pliku zaszyfrowanego: OK"
else
  echo "Uwaga: brak pliku $BASE.sha256 obok kopii – pomijam sprawdzenie sumy."
fi

mkdir -p "$OUT"
age -d -i "$KEY" -o "$OUT/$BASE.tar.gz" "$FILE"
if [ -f "$SUMS" ]; then
  expected="$(grep " $BASE.tar.gz\$" "$SUMS" | cut -d' ' -f1)"
  actual="$(sha256sum "$OUT/$BASE.tar.gz" | cut -d' ' -f1)"
  [ -z "$expected" ] || [ "$expected" = "$actual" ] || fail "suma SHA-256 po odszyfrowaniu się nie zgadza"
fi
tar -C "$OUT" -xzf "$OUT/$BASE.tar.gz"
rm -f "$OUT/$BASE.tar.gz"

DIR="$OUT/$BASE"
if [ -f "$DIR/data.sql" ]; then
  for f in roles.sql schema.sql data.sql manifest.txt row-counts.tsv; do
    [ -s "$DIR/$f" ] || fail "w kopii brak pliku $f"
  done
  grep -q 'COPY "auth"."users"' "$DIR/data.sql" || fail "kopia bez kont (auth.users)"
  echo "--- manifest"
  cat "$DIR/manifest.txt"
  echo "--- liczby wierszy w chwili kopii"
  column -t -s $'\t' "$DIR/row-counts.tsv" 2>/dev/null || cat "$DIR/row-counts.tsv"
else
  echo "Kopia plików Storage: $(find "$DIR" -type f | wc -l) plik(ów)"
fi
echo "Odszyfrowano do: $DIR"
