/**
 * Rozpoznawanie skróconego zapisu receptury (jak w zeszycie Kingi) – z tekstu i z dyktowania klawiatury:
 *   „9.008, -10g, 8.36-10g, 8.000-10g, 8.21-10g/6%”
 *   „odrost: 7.1-30g 1:1,5 6% 35 min” (nowa linia albo „;” = kolejna mieszanka)
 * Wynik to podgląd (mieszanki, pozycje, uwagi i założenia) – nic nie jest zapisywane bez potwierdzenia.
 *
 * Założenia (oznaczane w podglądzie, do potwierdzenia z Kingą):
 *  - samotne „-10g” po przecinku = gramy poprzedniego odcienia,
 *  - „/6%” (stężenie) = utleniacz całej mieszanki,
 *  - jedna linia = jedna mieszanka.
 */
import { parseRatio, shadeKey } from "@/lib/catalog/values";
import { ZONES, ZONE_LABELS, type DraftMix, type MixZone } from "./recipe";
import { fold, normalizeSpoken } from "./spoken";

export type NotationProduct = { id: string; brand: string; line: string; shade: string };

export type NotationItem = {
  /** Odcień z tekstu (po normalizacji, np. „9.008”). */
  shade: string;
  grams: number | null;
  /** Wybrany produkt (null = brak w katalogu). */
  productId: string | null;
  /** Wszystkie pasujące produkty (więcej niż 1 = do wyboru w podglądzie). */
  candidates: string[];
  notes: string[];
};

export type NotationMix = {
  zone: MixZone;
  zoneGiven: boolean;
  /** null = bez utleniacza. */
  oxidant_percent: number | null;
  oxidantGiven: boolean;
  ratio: number | null;
  processing_minutes: number | null;
  items: NotationItem[];
  notes: string[];
};

export type NotationResult = { mixes: NotationMix[]; skipped: string[]; multiLine: boolean };

export const DEFAULT_OXIDANT_PERCENT = 6;

export const NOTATION_ASSUMPTIONS = [
  "Samotne „-10g” po przecinku to gramy poprzedniego odcienia.",
  "„/6%” na końcu to utleniacz całej mieszanki.",
  "Jedna linia to jedna mieszanka.",
] as const;

const ZONE_WORDS: [RegExp, MixZone][] = [
  [/^odrost/, "odrost"],
  [/^dlugos/, "dlugosci"],
  [/^konc/, "konce"],
  [/^calos|^cala$|^calej$/, "calosc"],
  [/^pasem|^baleyage|^balayage/, "pasemka"],
];
const OXIDANT_WORDS = /^(utleniacz|utleniacza|utleniaczem|oksydant|oxy|oxydant|aktywator|woda)$/;
const IGNORED_WORDS = new Set(["i", "oraz", "plus", "z", "ze", "farba", "farby", "farbe", "mieszanka", "mieszanki", "proporcja", "czas", "do", "na", "x"]);

type Token =
  | { kind: "num"; text: string; value: number }
  | { kind: "g" | "pct" | "min" | "sep" }
  | { kind: "ratio"; value: number }
  | { kind: "word"; text: string; folded: string };

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*[:]\s*(\d+(?:[.,]\d+)?)|\d+(?:[.,]\d+)?|%|,|;|\p{L}+/gu;
  for (const m of line.matchAll(re)) {
    const t = m[0];
    if (m[1] !== undefined) {
      const r = parseRatio(`${m[1]}:${m[2]}`);
      if (typeof r === "number") tokens.push({ kind: "ratio", value: r });
    } else if (/^\d/.test(t)) tokens.push({ kind: "num", text: t, value: Number(t.replace(",", ".")) });
    else if (t === "%") tokens.push({ kind: "pct" });
    else if (t === "," || t === ";") tokens.push({ kind: "sep" });
    else {
      const folded = fold(t);
      if (folded === "g" || folded === "gr") tokens.push({ kind: "g" });
      else if (folded === "min") tokens.push({ kind: "min" });
      else tokens.push({ kind: "word", text: t, folded });
    }
  }
  return tokens;
}

/** Odcień z kolejnych liczb: „8.36” → 8.36; „8 36” → 8.36; „9 0 0 8” → 9.008; „8,000” → 8.000. */
function buildShade(parts: string[]): string {
  if (parts.length === 1) return shadeKey(parts[0]);
  return `${parts[0].replace(",", ".")}.${parts.slice(1).join("").replace(/[.,]/g, "")}`;
}

const digitsOf = (shade: string) => shadeKey(shade).replace(/\D/g, "");

type Draft = {
  zone: MixZone;
  zoneGiven: boolean;
  oxidant: number | null;
  oxidantGiven: boolean;
  ratio: number | null;
  minutes: number | null;
  items: { shade: string; grams: number | null; notes: string[] }[];
  brandHint: string | null;
  notes: string[];
};

const emptyDraft = (zone: MixZone = "calosc", zoneGiven = false): Draft => ({
  zone,
  zoneGiven,
  oxidant: DEFAULT_OXIDANT_PERCENT,
  oxidantGiven: false,
  ratio: null,
  minutes: null,
  items: [],
  brandHint: null,
  notes: [],
});

/**
 * @param products farby salonu w kolejności preferencji (najczęściej używane najpierw)
 * @param preferredBrands marki z ostatniej receptury klientki – wybierane przy kilku markach z tym samym odcieniem
 */
export function parseNotation(
  text: string,
  products: readonly NotationProduct[],
  preferredBrands: readonly string[] = [],
): NotationResult {
  const lines = normalizeSpoken(text)
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  const brands = [...new Set(products.map((p) => p.brand))].map((b) => ({ brand: b, folded: fold(b) }));
  const drafts: Draft[] = [];
  const skipped: string[] = [];

  for (const line of lines) {
    let mix = emptyDraft();
    let pending: string[] = [];
    let afterSep = false;
    let oxidantWord = false;
    let bez = false;
    const tokens = tokenize(line);

    const flush = () => {
      if (pending.length) mix.items.push({ shade: buildShade(pending), grams: null, notes: [] });
      pending = [];
    };
    const finish = () => {
      flush();
      if (mix.items.length || mix.oxidantGiven || mix.zoneGiven) drafts.push(mix);
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const next = tokens[i + 1];
      if (t.kind === "num") {
        if (next?.kind === "g") {
          i++;
          if (pending.length) {
            mix.items.push({ shade: buildShade(pending), grams: t.value, notes: [] });
            pending = [];
          } else {
            const last = mix.items[mix.items.length - 1];
            if (last && last.grams === null) {
              last.grams = t.value;
              if (afterSep) last.notes.push(`„-${t.text}g” przypisane do ${last.shade} (założenie)`);
            } else skipped.push(`${t.text} g (bez odcienia)`);
          }
        } else if (next?.kind === "pct" || oxidantWord) {
          if (next?.kind === "pct") i++;
          flush();
          mix.oxidant = t.value;
          mix.oxidantGiven = true;
          oxidantWord = false;
        } else if (next?.kind === "min") {
          i++;
          flush();
          mix.minutes = Math.round(t.value);
        } else {
          pending.push(t.text);
        }
        afterSep = false;
      } else if (t.kind === "sep") {
        flush();
        afterSep = true;
      } else if (t.kind === "ratio") {
        flush();
        mix.ratio = t.value;
      } else if (t.kind === "word") {
        const zone = ZONE_WORDS.find(([re]) => re.test(t.folded))?.[1];
        if (zone) {
          if (mix.items.length || pending.length) {
            finish();
            mix = emptyDraft(zone, true);
          } else {
            mix.zone = zone;
            mix.zoneGiven = true;
          }
        } else if (t.folded === "bez") {
          bez = true;
          continue;
        } else if (OXIDANT_WORDS.test(t.folded)) {
          if (bez) {
            mix.oxidant = null;
            mix.oxidantGiven = true;
          } else oxidantWord = true;
        } else {
          const brand = brands.find((b) => b.folded === t.folded || b.folded.split(/\s+/)[0] === t.folded);
          if (brand) mix.brandHint = brand.brand;
          else if (!IGNORED_WORDS.has(t.folded)) skipped.push(t.text);
        }
        bez = false;
      } else {
        // „g”, „%”, „min” bez liczby – pomijamy
      }
    }
    finish();
  }

  const mixes = drafts.map((d) => toNotationMix(d, products, preferredBrands));
  return { mixes, skipped, multiLine: mixes.length > 1 };
}

function toNotationMix(d: Draft, products: readonly NotationProduct[], preferredBrands: readonly string[]): NotationMix {
  const notes = [...d.notes];
  if (!d.zoneGiven) notes.push(`Strefa: ${ZONE_LABELS.calosc} (nie podano)`);
  if (!d.oxidantGiven) notes.push(`Utleniacz ${DEFAULT_OXIDANT_PERCENT}% – domyślny (nie podano stężenia)`);
  else if (d.oxidant !== null) notes.push(`${String(d.oxidant).replace(".", ",")}% – utleniacz całej mieszanki (założenie)`);
  if (d.oxidant !== null && (d.oxidant <= 0 || d.oxidant > 20)) {
    notes.push(`Nieprawidłowe stężenie ${d.oxidant}% – użyto ${DEFAULT_OXIDANT_PERCENT}%`);
    d.oxidant = DEFAULT_OXIDANT_PERCENT;
  }

  const items = d.items.map((it): NotationItem => {
    const itemNotes = [...it.notes];
    const key = shadeKey(it.shade);
    let matches = products.filter((p) => shadeKey(p.shade) === key);
    if (matches.length === 0) {
      matches = products.filter((p) => digitsOf(p.shade) === digitsOf(key));
      if (matches.length > 0) itemNotes.push(`Rozpoznano jako ${matches[0].shade}`);
    }
    if (d.brandHint) {
      const branded = matches.filter((p) => p.brand === d.brandHint);
      if (branded.length) matches = branded;
    }
    const preferred = preferredBrands.map((b) => matches.find((p) => p.brand === b)).find(Boolean);
    const chosen = preferred ?? matches[0] ?? null;
    if (matches.length > 1 && new Set(matches.map((p) => p.brand)).size > 1) {
      itemNotes.push(`${matches.length} produkty z odcieniem ${it.shade} – wybrano ${chosen!.brand}`);
    }
    if (!chosen) itemNotes.push("Nie ma w katalogu");
    if (it.grams === null) itemNotes.push("Brak gramów – uzupełnij");
    else if (it.grams <= 0 || it.grams > 1000) itemNotes.push("Nieprawidłowe gramy");
    return { shade: it.shade, grams: it.grams, productId: chosen?.id ?? null, candidates: matches.map((p) => p.id), notes: itemNotes };
  });

  return {
    zone: d.zone,
    zoneGiven: d.zoneGiven,
    oxidant_percent: d.oxidant,
    oxidantGiven: d.oxidantGiven,
    ratio: d.oxidant === null ? null : d.ratio,
    processing_minutes: d.minutes !== null && d.minutes >= 0 && d.minutes <= 600 ? d.minutes : null,
    items,
    notes,
  };
}

/** Czy pozycja trafi do receptury (jest produkt i poprawne gramy). */
export function isUsable(item: Pick<NotationItem, "productId" | "grams">): boolean {
  return item.productId !== null && item.grams !== null && item.grams > 0 && item.grams <= 1000;
}

/**
 * Mieszanki do formularza (tylko pozycje z produktem i gramami). Proporcja: podana albo podpowiedź z katalogu
 * (`suggest` – jak w formularzu: z pierwszego produktu).
 */
export function notationToMixes(
  mixes: readonly NotationMix[],
  suggest: (items: DraftMix["items"]) => number | null,
): (DraftMix & { ratioGiven: boolean })[] {
  return mixes
    .map((m) => {
      const items = m.items.filter(isUsable).map((i) => ({ product_id: i.productId as string, grams: i.grams as number }));
      const ratio = m.oxidant_percent === null ? null : (m.ratio ?? suggest(items));
      return {
        zone: m.zone,
        oxidant_percent: m.oxidant_percent,
        ratio,
        processing_minutes: m.processing_minutes,
        items,
        ratioGiven: m.ratio !== null,
      };
    })
    .filter((m) => m.items.length > 0);
}

export { ZONES };
