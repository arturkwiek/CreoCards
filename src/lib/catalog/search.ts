/**
 * Wyszukiwarka katalogu z podpowiedziami (w przeglądarce, katalog salonu jest mały).
 * „7.1”, „7,1” i „7/1” dają ten sam wynik; „7” pokazuje 7.0, 7.1…, ale nie 10.1 ani 77.0;
 * „6%” lub „6” znajduje utleniacz 6%. Słowa dopasowują markę, linię i typ.
 * Bez frazy: marka, linia, odcień (sortowanie naturalne). Z frazą: najlepsze dopasowania na górze.
 */
import { normalizeText } from "@/lib/clients/search";
import { PRODUCT_TYPE_LABELS, compareShades, shadeKey, type ProductType } from "./values";

export type SearchableProduct = {
  brand: string;
  line: string;
  shade: string;
  type: ProductType;
};

function shadeScore(token: string, key: string): number {
  if (key === token) return 100;
  if (!key.startsWith(token)) return 0;
  // „7” nie pasuje do „77.0”; „7.1” pasuje też do „7.11” (pochodna odcienia).
  const next = key[token.length];
  if (token.includes(".") || !/\d/.test(next)) return 60;
  return 0;
}

function wordScore(token: string, text: string): number {
  const words = text.split(" ");
  if (words.includes(token)) return 50;
  if (words.some((w) => w.startsWith(token))) return 35;
  if (token.length >= 3 && text.includes(token)) return 15;
  return 0;
}

function tokenScore(token: string, product: SearchableProduct): number {
  const words = normalizeText(`${product.brand} ${product.line}`);
  if (/^\d/.test(token)) {
    // Liczba to odcień / stężenie; ewentualnie całe słowo nazwy linii („Oxyd 12”).
    return shadeScore(token, shadeKey(product.shade)) || (words.split(" ").includes(token) ? 50 : 0);
  }
  const shade = normalizeText(product.shade);
  const type = normalizeText(PRODUCT_TYPE_LABELS[product.type]);
  return Math.max(wordScore(token, words), wordScore(token, shade), type.startsWith(token) ? 30 : 0);
}

/** Wynik dopasowania (0 = brak). Każde słowo frazy musi pasować. */
export function productScore(product: SearchableProduct, query: string): number {
  const tokens = normalizeText(query).split(" ").map(shadeKey).filter(Boolean);
  if (tokens.length === 0) return 0;
  let total = 0;
  for (const token of tokens) {
    const score = tokenScore(token, product);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

export function compareProducts(a: SearchableProduct, b: SearchableProduct): number {
  return (
    a.brand.localeCompare(b.brand, "pl") ||
    a.line.localeCompare(b.line, "pl") ||
    compareShades(a.shade, b.shade)
  );
}

export function filterProducts<T extends SearchableProduct>(
  products: readonly T[],
  query: string,
  type?: ProductType | null,
): T[] {
  const pool = type ? products.filter((p) => p.type === type) : [...products];
  if (!normalizeText(query)) return pool.sort(compareProducts);
  return pool
    .map((product) => ({ product, score: productScore(product, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || compareProducts(a.product, b.product))
    .map((r) => r.product);
}
