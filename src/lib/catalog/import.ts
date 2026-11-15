/**
 * Import katalogu z CSV: rozpoznanie kolumn (w dowolnej kolejności, nagłówki z
 * docs/katalog-przyklad.csv lub polskie z arkusza katalogu), walidacja wierszy,
 * podział proporcji na domyślną linii i własną produktu oraz podgląd zmian przed zapisem.
 * Zapis wykonuje funkcja bazy import_products (wszystko albo nic) z tą samą logiką.
 */
import { normalizeText } from "@/lib/clients/search";
import { parseCsv } from "./csv";
import {
  BRAND_MAX,
  LINE_MAX,
  SHADE_MAX,
  formatRatio,
  lineKey,
  parsePackageSize,
  parsePrice,
  parseProductType,
  parseRatio,
  shadeKey,
  type ProductType,
} from "./values";

export const IMPORT_MAX_BYTES = 500_000;
export const IMPORT_MAX_ROWS = 5000;

export type ImportField = "brand" | "line" | "shade" | "type" | "package_size" | "purchase_price" | "ratio";

const FIELD_LABELS: Record<ImportField, string> = {
  brand: "Marka",
  line: "Linia",
  shade: "Odcień / stężenie",
  type: "Typ",
  package_size: "Pojemność",
  purchase_price: "Cena zakupu",
  ratio: "Domyślna proporcja",
};

const REQUIRED_FIELDS: readonly ImportField[] = ["brand", "shade", "type"];

/** Kolumny celowo pomijane (bez ostrzeżenia). */
const IGNORED_HEADERS = new Set(["uwagi", "notatki", "komentarz"]);

/** Nagłówek → pole importu albo null (kolumna nieznana). */
export function headerField(header: string): ImportField | "ignore" | null {
  const key = normalizeText(header).replace(/[^a-z0-9]/g, "");
  if (!key || IGNORED_HEADERS.has(key)) return "ignore";
  if (key === "marka") return "brand";
  if (key === "linia") return "line";
  if (key.startsWith("odcien") || key.startsWith("stezenie")) return "shade";
  if (key === "typ" || key === "rodzaj") return "type";
  if (key.startsWith("pojemnosc")) return "package_size";
  if (key.startsWith("cena")) return "purchase_price";
  if (key.endsWith("proporcja")) return "ratio";
  return null;
}

export type ImportRow = {
  row: number;
  brand: string;
  line: string;
  shade: string;
  type: ProductType;
  package_size: number | null;
  purchase_price: number | null;
  ratio: number | null;
};

/** Element przekazywany do import_products. Brak klucza = bez zmian. */
export type ImportItem = {
  brand: string;
  line: string;
  shade: string;
  type: ProductType;
  package_size?: number;
  purchase_price?: number;
  line_ratio?: number;
  ratio?: number | null;
};

export type ImportIssue = { row: number; message: string };

export type ParsedImport = {
  /** Błąd całego pliku (np. brak wymaganych kolumn). */
  fatal?: string;
  rows: ImportRow[];
  items: ImportItem[];
  errors: ImportIssue[];
  warnings: string[];
};

function cell(record: string[], index: number | undefined): string {
  return index === undefined ? "" : (record[index] ?? "").trim();
}

export function parseImport(text: string): ParsedImport {
  const empty = { rows: [], items: [], errors: [], warnings: [] };
  const records = parseCsv(text);
  if (records.length === 0) return { ...empty, fatal: "Plik jest pusty." };
  if (records.length - 1 > IMPORT_MAX_ROWS) {
    return { ...empty, fatal: `Za dużo wierszy (maks. ${IMPORT_MAX_ROWS}).` };
  }

  const [header, ...data] = records;
  const columns: Partial<Record<ImportField, number>> = {};
  const unknown: string[] = [];
  header.forEach((name, index) => {
    const field = headerField(name);
    if (field === "ignore") return;
    if (field === null) unknown.push(name.trim());
    else if (columns[field] === undefined) columns[field] = index;
  });

  const missing = REQUIRED_FIELDS.filter((f) => columns[f] === undefined);
  if (missing.length > 0) {
    return {
      ...empty,
      fatal: `Brak wymaganych kolumn: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}.`,
    };
  }

  const warnings: string[] = [];
  if (unknown.length > 0) warnings.push(`Pominięto nieznane kolumny: ${unknown.join(", ")}.`);

  const errors: ImportIssue[] = [];
  const byKey = new Map<string, ImportRow>();

  data.forEach((record, i) => {
    const row = i + 2; // wiersz 1 = nagłówek
    const brand = cell(record, columns.brand);
    const line = cell(record, columns.line);
    const shade = cell(record, columns.shade);
    const typeText = cell(record, columns.type);
    const problems: string[] = [];

    if (!brand) problems.push("brak marki");
    else if (brand.length > BRAND_MAX) problems.push(`marka dłuższa niż ${BRAND_MAX} znaków`);
    if (line.length > LINE_MAX) problems.push(`linia dłuższa niż ${LINE_MAX} znaków`);
    if (!shade) problems.push("brak odcienia / stężenia");
    else if (shade.length > SHADE_MAX) problems.push(`odcień dłuższy niż ${SHADE_MAX} znaków`);

    const type = parseProductType(typeText);
    if (!type) {
      problems.push(
        typeText ? `nieznany typ „${typeText}” (farba, utleniacz, rozjaśniacz, toner, inny)` : "brak typu",
      );
    }
    const size = parsePackageSize(cell(record, columns.package_size));
    if (size === "invalid") problems.push("nieprawidłowa pojemność");
    const price = parsePrice(cell(record, columns.purchase_price));
    if (price === "invalid") problems.push("nieprawidłowa cena");
    const ratio = parseRatio(cell(record, columns.ratio));
    if (ratio === "invalid") problems.push("nieprawidłowa proporcja (np. 1:1,5)");

    if (problems.length > 0 || !type || size === "invalid" || price === "invalid" || ratio === "invalid") {
      errors.push({ row, message: problems.join(", ") });
      return;
    }

    const parsed: ImportRow = { row, brand, line, shade, type, package_size: size, purchase_price: price, ratio };
    const key = `${lineKey(brand, line)}\u0000${shadeKey(shade)}`;
    const previous = byKey.get(key);
    if (previous) {
      warnings.push(`Wiersz ${row} powtarza wiersz ${previous.row} (${brand} ${line} ${shade}) – użyto wiersza ${row}.`);
      byKey.delete(key);
    }
    byKey.set(key, parsed);
  });

  const rows = [...byKey.values()].sort((a, b) => a.row - b.row);
  return { rows, items: toImportItems(rows), errors, warnings };
}

/**
 * Domyślna proporcja linii = najczęstsza proporcja w jej wierszach (przy remisie – pierwsza).
 * Wiersz z inną proporcją dostaje własną proporcję produktu; wiersz bez proporcji niczego nie zmienia.
 */
export function lineRatios(rows: readonly ImportRow[]): Map<string, number> {
  const counts = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (r.ratio === null) continue;
    const key = lineKey(r.brand, r.line);
    const lineCounts = counts.get(key) ?? new Map<number, number>();
    lineCounts.set(r.ratio, (lineCounts.get(r.ratio) ?? 0) + 1);
    counts.set(key, lineCounts);
  }
  const result = new Map<string, number>();
  for (const [key, lineCounts] of counts) {
    let best: [number, number] | null = null;
    for (const entry of lineCounts) if (!best || entry[1] > best[1]) best = entry;
    if (best) result.set(key, best[0]);
  }
  return result;
}

export function toImportItems(rows: readonly ImportRow[]): ImportItem[] {
  const defaults = lineRatios(rows);
  return rows.map((r) => {
    const item: ImportItem = { brand: r.brand, line: r.line, shade: r.shade, type: r.type };
    if (r.package_size !== null) item.package_size = r.package_size;
    if (r.purchase_price !== null) item.purchase_price = r.purchase_price;
    const lineRatio = defaults.get(lineKey(r.brand, r.line));
    if (lineRatio !== undefined) item.line_ratio = lineRatio;
    if (r.ratio !== null) item.ratio = r.ratio === lineRatio ? null : r.ratio;
    return item;
  });
}

// ---------------------------------------------------------------------------
// Podgląd: porównanie z bieżącym katalogiem (ta sama logika co import_products).
// ---------------------------------------------------------------------------

export type ExistingLine = { brand: string; name: string; default_ratio: number | null };
export type ExistingProduct = {
  brand: string;
  line: string;
  shade: string;
  type: ProductType;
  package_size: number | null;
  purchase_price: number | null;
  ratio: number | null;
};

export type ImportPlan = {
  newLines: string[];
  updatedLines: string[];
  newProducts: number;
  updatedProducts: number;
  unchangedProducts: number;
};

const lineLabel = (brand: string, line: string) => (line ? `${brand} ${line}` : brand);

export function planImport(
  items: readonly ImportItem[],
  existingLines: readonly ExistingLine[],
  existingProducts: readonly ExistingProduct[],
): ImportPlan {
  const lines = new Map(existingLines.map((l) => [lineKey(l.brand, l.name), { ...l }]));
  const products = new Map(
    existingProducts.map((p) => [`${lineKey(p.brand, p.line)}\u0000${shadeKey(p.shade)}`, { ...p }]),
  );
  const plan: ImportPlan = { newLines: [], updatedLines: [], newProducts: 0, updatedProducts: 0, unchangedProducts: 0 };

  for (const item of items) {
    const lk = lineKey(item.brand, item.line);
    const line = lines.get(lk);
    const ratioLabel = item.line_ratio !== undefined ? ` (proporcja ${formatRatio(item.line_ratio)})` : "";
    if (!line) {
      lines.set(lk, { brand: item.brand, name: item.line, default_ratio: item.line_ratio ?? null });
      plan.newLines.push(lineLabel(item.brand, item.line) + ratioLabel);
    } else if (item.line_ratio !== undefined && line.default_ratio !== item.line_ratio) {
      line.default_ratio = item.line_ratio;
      plan.updatedLines.push(lineLabel(line.brand, line.name) + ratioLabel);
    }

    const pk = `${lk}\u0000${shadeKey(item.shade)}`;
    const product = products.get(pk);
    if (!product) {
      products.set(pk, {
        brand: item.brand,
        line: item.line,
        shade: item.shade,
        type: item.type,
        package_size: item.package_size ?? null,
        purchase_price: item.purchase_price ?? null,
        ratio: item.ratio ?? null,
      });
      plan.newProducts++;
      continue;
    }
    const next = {
      type: item.type,
      package_size: item.package_size ?? product.package_size,
      purchase_price: item.purchase_price ?? product.purchase_price,
      ratio: "ratio" in item ? (item.ratio ?? null) : product.ratio,
    };
    const changed =
      next.type !== product.type ||
      next.package_size !== product.package_size ||
      next.purchase_price !== product.purchase_price ||
      next.ratio !== product.ratio;
    if (changed) {
      Object.assign(product, next);
      plan.updatedProducts++;
    } else {
      plan.unchangedProducts++;
    }
  }
  return plan;
}
