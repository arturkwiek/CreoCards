/**
 * Wartości katalogu preparatów: typy, proporcje, liczby z przecinkiem, odcienie.
 * Wspólne dla formularzy, importu CSV i wyszukiwarki.
 */
import type { Database } from "@/lib/supabase/database.types";
import { normalizeText } from "@/lib/clients/search";

export type ProductType = Database["public"]["Enums"]["product_type"];
export type ProductRequestKind = Database["public"]["Enums"]["product_request_kind"];

export const PRODUCT_TYPES: readonly ProductType[] = ["farba", "utleniacz", "rozjasniacz", "toner", "inny"];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  farba: "Farba",
  utleniacz: "Utleniacz",
  rozjasniacz: "Rozjaśniacz",
  toner: "Toner",
  inny: "Inny",
};

export const BRAND_MAX = 80;
export const LINE_MAX = 80;
export const SHADE_MAX = 40;
export const REQUEST_TEXT_MAX = 500;
export const RATIO_MAX = 10;
export const AMOUNT_MAX = 100000;

/** Typ bez względu na wielkość liter i polskie znaki („Rozjaśniacz” → rozjasniacz). */
export function parseProductType(value: string): ProductType | null {
  const key = normalizeText(value);
  if (key === "inne") return "inny";
  return (PRODUCT_TYPES as readonly string[]).includes(key) ? (key as ProductType) : null;
}

/** Liczba z przecinkiem lub kropką, z opcjonalną jednostką („60 g”, „12,50 zł”). */
export function parseAmount(value: string, units: readonly string[] = []): number | null | "invalid" {
  let text = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;
  for (const unit of units) {
    if (text.endsWith(unit)) {
      text = text.slice(0, -unit.length).trim();
      break;
    }
  }
  text = text.replace(/\s/g, "");
  if (!/^\d+([.,]\d+)?$/.test(text)) return "invalid";
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : "invalid";
}

export const SIZE_UNITS = ["ml", "g"] as const;
export const PRICE_UNITS = ["zł", "zl", "pln"] as const;

export function parsePackageSize(value: string): number | null | "invalid" {
  const n = parseAmount(value, SIZE_UNITS);
  return typeof n === "number" && (n <= 0 || n > AMOUNT_MAX) ? "invalid" : n;
}

export function parsePrice(value: string): number | null | "invalid" {
  const n = parseAmount(value, PRICE_UNITS);
  return typeof n === "number" && n > AMOUNT_MAX ? "invalid" : n;
}

/**
 * Proporcja farba:utleniacz → część utleniacza na 1 część farby.
 * „1:1.5”, „1:1,5”, „1+1,5”, „1,5” → 1.5. Puste, „inna”, „inna (w uwagach)” → null (brak proporcji).
 */
export function parseRatio(value: string): number | null | "invalid" {
  const text = normalizeText(value).replace(/\s/g, "");
  if (!text || text.startsWith("inna")) return null;
  const match = /^(?:(\d+(?:[.,]\d+)?)[:+])?(\d+(?:[.,]\d+)?)$/.exec(text);
  if (!match) return "invalid";
  const color = match[1] ? Number(match[1].replace(",", ".")) : 1;
  const oxidant = Number(match[2].replace(",", "."));
  if (!(color > 0)) return "invalid";
  const ratio = Math.round((oxidant / color) * 100) / 100;
  return ratio > 0 && ratio <= RATIO_MAX ? ratio : "invalid";
}

/** 1.5 → „1:1,5”. */
export function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return "";
  return `1:${formatNumber(ratio)}`;
}

/** Liczba po polsku, bez zbędnych zer (1.50 → „1,5”). */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

export function formatPrice(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} zł`;
}

/** Proporcja obowiązująca dla produktu: własna albo domyślna linii. */
export function effectiveRatio(productRatio: number | null, lineRatio: number | null): number | null {
  return productRatio ?? lineRatio;
}

/** Postać porównawcza odcienia – jak kolumna products.shade_key („7,1”, „7/1” → „7.1”). */
export function shadeKey(shade: string): string {
  return shade.replace(/\s/g, "").toLowerCase().replace(/[,/]/g, ".");
}

/** Klucz linii – jak unikalny indeks w bazie (marka i linia bez względu na wielkość liter). */
export function lineKey(brand: string, line: string): string {
  return `${brand.trim().toLowerCase()}\u0000${line.trim().toLowerCase()}`;
}

/** Sortowanie naturalne odcieni: 6.0 < 7.1 < 7.11 < 10.1, 3% < 12%. */
export function compareShades(a: string, b: string): number {
  const pa = shadeKey(a).match(/\d+|\D+/g) ?? [];
  const pb = shadeKey(b).match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    const nx = /^\d/.test(x);
    const ny = /^\d/.test(y);
    if (nx && ny) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else if (x !== y) {
      if (nx !== ny) return nx ? -1 : 1;
      return x < y ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

/** Proporcje do wyboru przyciskami (SPEC: 1:1, 1:1,5, 1:2, własna). */
export const RATIO_PRESETS = [1, 1.5, 2] as const;
