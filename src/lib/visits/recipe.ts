/**
 * Receptura koloryzacji: mieszanki (strefa, farby w gramach, utleniacz, czas), wyliczanie gramów utleniacza,
 * podpowiedź proporcji, dobór utleniacza z katalogu, walidacja i skrót do listy wizyt.
 * Gramy utleniacza liczy też baza (save_recipe) – tą samą formułą.
 */
import type { Database } from "@/lib/supabase/database.types";
import { effectiveRatio, formatNumber, formatRatio, shadeKey } from "@/lib/catalog/values";

export type MixZone = Database["public"]["Enums"]["mix_zone"];

export const ZONES: readonly MixZone[] = ["calosc", "odrost", "dlugosci", "konce", "pasemka", "inne"];

export const ZONE_LABELS: Record<MixZone, string> = {
  calosc: "Całość",
  odrost: "Odrost",
  dlugosci: "Długości",
  konce: "Końce",
  pasemka: "Pasemka",
  inne: "Inne",
};

export const OXIDANT_PERCENTS = [3, 6, 9, 12] as const;
export const GRAM_PRESETS = [30, 60, 90] as const;
export const GRAM_STEP = 5;
export const TIME_PRESETS = [20, 30, 35, 45] as const;
export const TIME_STEP = 5;
export const MAX_MIXES = 10;
export const MAX_ITEMS = 10;
export const RECIPE_NOTE_MAX = 500;

export type DraftItem = { product_id: string; grams: number };
export type DraftMix = {
  zone: MixZone;
  /** null = bez utleniacza. */
  oxidant_percent: number | null;
  ratio: number | null;
  processing_minutes: number | null;
  items: DraftItem[];
};
export type DraftRecipe = { note: string; mixes: DraftMix[] };

export const EMPTY_MIX: DraftMix = { zone: "calosc", oxidant_percent: 6, ratio: null, processing_minutes: null, items: [] };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function dyeGrams(mix: Pick<DraftMix, "items">): number {
  return round1(mix.items.reduce((sum, i) => sum + i.grams, 0));
}

/** Gramy utleniacza = suma gramów farb × proporcja; bez utleniacza = 0. */
export function oxidantGrams(mix: Pick<DraftMix, "items" | "oxidant_percent" | "ratio">): number {
  if (mix.oxidant_percent === null || mix.ratio === null) return 0;
  return round1(dyeGrams(mix) * mix.ratio);
}

export type RatioSource = { id: string; ratio: number | null; line_ratio: number | null };

/** Podpowiedź proporcji z pierwszego produktu mieszanki (własna produktu albo domyślna linii). */
export function suggestRatio(items: readonly DraftItem[], products: ReadonlyMap<string, RatioSource>): number | null {
  const first = items[0] && products.get(items[0].product_id);
  return first ? effectiveRatio(first.ratio, first.line_ratio) : null;
}

export type OxidantCandidate = { id: string; brand: string; shade: string; type: string };

/** Utleniacz z katalogu tej samej marki co pierwsza farba i o wybranym stężeniu („6%”, „6 %”, „6,0%”). */
export function findOxidant(
  products: readonly OxidantCandidate[],
  brand: string | undefined,
  percent: number | null,
): string | null {
  if (!brand || percent === null) return null;
  const wanted = brand.trim().toLowerCase();
  const match = products.find((p) => {
    if (p.type !== "utleniacz" || p.brand.trim().toLowerCase() !== wanted) return false;
    const m = /^(\d+(?:\.\d+)?)%?$/.exec(shadeKey(p.shade));
    return m !== null && Number(m[1]) === percent;
  });
  return match?.id ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Receptura z formularza (JSON). Mieszanki bez farb są pomijane (nic nie blokuje zapisu).
 * Produkty muszą być w katalogu salonu (`productIds`).
 */
export function parseRecipe(
  json: string,
  productIds: ReadonlySet<string>,
): { recipe: DraftRecipe; error?: undefined } | { recipe?: undefined; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '{"note":"","mixes":[]}');
  } catch {
    return { error: "Nie udało się odczytać receptury." };
  }
  if (typeof raw !== "object" || raw === null) return { error: "Nie udało się odczytać receptury." };
  const { note = "", mixes = [] } = raw as { note?: unknown; mixes?: unknown };
  if (typeof note !== "string" || !Array.isArray(mixes)) return { error: "Nie udało się odczytać receptury." };
  if (note.trim().length > RECIPE_NOTE_MAX) return { error: `Notatka receptury: maks. ${RECIPE_NOTE_MAX} znaków.` };
  if (mixes.length > MAX_MIXES) return { error: `Maks. ${MAX_MIXES} mieszanek.` };

  const result: DraftMix[] = [];
  for (const [index, value] of mixes.entries()) {
    const n = index + 1;
    const m = value as Partial<DraftMix>;
    if (!ZONES.includes(m.zone as MixZone)) return { error: `Mieszanka ${n}: wybierz strefę.` };
    if (!Array.isArray(m.items) || m.items.length > MAX_ITEMS) return { error: `Mieszanka ${n}: maks. ${MAX_ITEMS} farb.` };

    const items: DraftItem[] = [];
    for (const item of m.items as Partial<DraftItem>[]) {
      if (typeof item?.product_id !== "string" || !UUID.test(item.product_id) || !productIds.has(item.product_id)) {
        return { error: `Mieszanka ${n}: produktu nie ma w katalogu.` };
      }
      if (!isNum(item.grams) || item.grams <= 0 || item.grams > 1000) {
        return { error: `Mieszanka ${n}: podaj gramy (1–1000).` };
      }
      items.push({ product_id: item.product_id, grams: round1(item.grams) });
    }
    if (items.length === 0) continue;

    const percent = m.oxidant_percent ?? null;
    if (percent !== null && (!isNum(percent) || percent <= 0 || percent > 20)) {
      return { error: `Mieszanka ${n}: nieprawidłowe stężenie utleniacza.` };
    }
    const ratio = percent === null ? null : (m.ratio ?? null);
    if (percent !== null && (!isNum(ratio) || ratio <= 0 || ratio > 10)) {
      return { error: `Mieszanka ${n}: wybierz proporcję utleniacza.` };
    }
    const minutes = m.processing_minutes ?? null;
    if (minutes !== null && (!isNum(minutes) || minutes < 0 || minutes > 600 || !Number.isInteger(minutes))) {
      return { error: `Mieszanka ${n}: czas w minutach (0–600).` };
    }
    result.push({ zone: m.zone as MixZone, oxidant_percent: percent, ratio, processing_minutes: minutes, items });
  }
  return { recipe: { note: note.trim(), mixes: result } };
}

export const isEmptyRecipe = (r: DraftRecipe) => r.mixes.length === 0 && r.note.trim() === "";

/** Skrót mieszanki: „Odrost: 7.1 30 g + 8.0 15 g · 6% 1:1,5 (67,5 g) · 35 min”. */
export function mixSummary(mix: DraftMix, label: (productId: string) => string): string {
  const dyes = mix.items.map((i) => `${label(i.product_id)} ${formatNumber(i.grams)} g`).join(" + ");
  const oxidant =
    mix.oxidant_percent === null
      ? "bez utleniacza"
      : `${formatNumber(mix.oxidant_percent)}% ${formatRatio(mix.ratio)} (${formatNumber(oxidantGrams(mix))} g)`;
  const time = mix.processing_minutes !== null ? ` · ${mix.processing_minutes} min` : "";
  return `${ZONE_LABELS[mix.zone]}: ${dyes} · ${oxidant}${time}`;
}

/** Kopia receptury do edycji („Powtórz ostatnią recepturę”) – tylko produkty wciąż obecne w katalogu. */
export function copyRecipe(recipe: DraftRecipe, productIds: ReadonlySet<string>): DraftRecipe {
  return {
    note: recipe.note,
    mixes: recipe.mixes
      .map((m) => ({ ...m, items: m.items.filter((i) => productIds.has(i.product_id)).map((i) => ({ ...i })) }))
      .filter((m) => m.items.length > 0),
  };
}

/** Produkty posortowane wg liczby użyć (malejąco), przy remisie – kolejność wejściowa. */
export function byUsage<T extends { id: string }>(products: readonly T[], usage: ReadonlyMap<string, number>): T[] {
  return products
    .map((p, i) => ({ p, i, uses: usage.get(p.id) ?? 0 }))
    .sort((a, b) => b.uses - a.uses || a.i - b.i)
    .map((x) => x.p);
}
