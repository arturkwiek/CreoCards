/**
 * Tekst z dyktowania klawiatury (Gboard, Samsung) → zapis z cyframi i symbolami:
 * liczebniki („trzydzieści sześć” → 36, „półtora” → 1,5), „kropka” → „.”, „gram” → „g”, „procent” → „%”,
 * „minut” → „min”, „do”/„na” w proporcji („jeden do półtora” → „1:1,5”).
 * Cyfry wpisane przez klawiaturę zostają bez zmian.
 */

const UNITS: Record<string, number> = {
  zero: 0,
  jeden: 1,
  jedna: 1,
  jedno: 1,
  dwa: 2,
  dwie: 2,
  dwoch: 2,
  trzech: 3,
  czterech: 4,
  trzy: 3,
  cztery: 4,
  piec: 5,
  szesc: 6,
  siedem: 7,
  osiem: 8,
  dziewiec: 9,
};

const TEENS: Record<string, number> = {
  dziesiec: 10,
  jedenascie: 11,
  dwanascie: 12,
  trzynascie: 13,
  czternascie: 14,
  pietnascie: 15,
  szesnascie: 16,
  siedemnascie: 17,
  osiemnascie: 18,
  dziewietnascie: 19,
};

const TENS: Record<string, number> = {
  dwadziescia: 20,
  trzydziesci: 30,
  czterdziesci: 40,
  piecdziesiat: 50,
  szescdziesiat: 60,
  siedemdziesiat: 70,
  osiemdziesiat: 80,
  dziewiecdziesiat: 90,
};

const HUNDREDS: Record<string, number> = {
  sto: 100,
  dwiescie: 200,
  trzysta: 300,
};

/** Małe litery bez polskich znaków (do porównań słów). */
export function fold(text: string): string {
  return text.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/\p{M}/gu, "");
}

/** Liczebnik zaczynający się od słowa i (zwraca wartość i liczbę zużytych słów) albo null. */
function readNumber(words: string[], i: number): { value: number; used: number } | null {
  const w = words[i];
  if (w === "poltora") return { value: 1.5, used: 1 };
  let value = 0;
  let used = 0;
  if (w in HUNDREDS) {
    value += HUNDREDS[w];
    used++;
  }
  const t = words[i + used];
  if (t !== undefined && t in TEENS) return { value: value + TEENS[t], used: used + 1 };
  if (t !== undefined && t in TENS) {
    value += TENS[t];
    used++;
  }
  const u = words[i + used];
  if (u !== undefined && u in UNITS && !(used > 0 && UNITS[u] === 0)) {
    value += UNITS[u];
    used++;
  }
  return used > 0 ? { value, used } : null;
}

const WORD = /[\p{L}]+|[^\p{L}]+/gu;
/** Znacznik wypowiedzianego „przecinka” (rozstrzygany po zamianie liczebników). */
const SPOKEN_COMMA = "\u0001";
/** Cyfry po kropce/przecinku: jedna liczba („008”) albo pojedyncze cyfry („0 0 8”), ale nie gramy ani procent. */
const DECIMALS = String.raw`\d{2,}|\d(?:\s+\d\b(?!\s*(?:g(?![a-z])|%|min(?![a-z]))))*`;
const SPOKEN_DECIMAL = new RegExp(String.raw`(\d)\s*\u0001\s*(${DECIMALS})`, "g");
const DOT_DECIMAL = new RegExp(String.raw`(\d)\s*\.\s*(${DECIMALS})`, "g");
const joinDecimal = (_m: string, a: string, b: string) => `${a}.${b.replace(/\s/g, "")}`;

/** Zamiana słów na cyfry i symbole; reszta tekstu bez zmian (także cyfry z klawiatury). */
export function normalizeSpoken(text: string): string {
  const parts = text.match(WORD) ?? [];
  const words = parts.map((p) => (/\p{L}/u.test(p) ? fold(p) : null));
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const w = words[i];
    if (w === null) {
      out.push(parts[i]);
      continue;
    }
    // Liczebnik może ciągnąć się przez kilka słów rozdzielonych spacją („trzydzieści sześć”).
    const seq: string[] = [];
    const idx: number[] = [];
    for (let j = i; j < parts.length; j++) {
      if (words[j] !== null) {
        seq.push(words[j] as string);
        idx.push(j);
      } else if (!/^\s+$/.test(parts[j])) break;
    }
    const n = readNumber(seq, 0);
    if (n) {
      out.push(String(n.value).replace(".", ","));
      i = idx[n.used - 1];
      continue;
    }
    if (w === "kropka") out.push(".");
    // Wypowiedziany „przecinek”: między cyframi odcienia = część dziesiętna, w innym miejscu = rozdzielenie.
    else if (w === "przecinek") out.push(SPOKEN_COMMA);
    else if (w === "srednik") out.push(";");
    else if (/^(g|gr|gram|gramy|gramow|grama|gramach)$/.test(w)) out.push("g");
    else if (/^(procent|procenty|procentow|proc)$/.test(w)) out.push("%");
    else if (/^(min|minut|minuty|minuta|minute)$/.test(w)) out.push("min");
    else out.push(parts[i]);
  }
  return (
    out
      .join("")
      // „9 przecinek 0 0 8” → „9.008”; pozostałe wypowiedziane przecinki rozdzielają pozycje
      .replace(SPOKEN_DECIMAL, joinDecimal)
      .replace(/\u0001/g, ",")
      // „9 . 0 0 8” z dyktowania → „9.008” („9.008 10 g” bez zmian)
      .replace(DOT_DECIMAL, joinDecimal)
      // „1 do 2”, „1 na 1,5” → proporcja „1:2”, „1:1,5”
      .replace(/\b(\d+(?:,\d+)?)\s+(?:do|na)\s+(\d+(?:,\d+)?)\b/gi, "$1:$2")
      // Spacje zwijane w obrębie linii – nowa linia rozdziela mieszanki.
      .replace(/[^\S\n]+/g, " ")
      .replace(/ ,/g, ",")
      .replace(/ *\n */g, "\n")
      .trim()
  );
}
