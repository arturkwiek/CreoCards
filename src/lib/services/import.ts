/**
 * Usługi salonu: parsowanie wartości (cena od–do, czas, „Z farbą?”) i import CSV z zakładki „Usługi”
 * arkusza: „Usługa”, „Cena od (zł)”, „Cena do (zł)”, „Czas (min)”, „Z farbą?” (TRUE/FALSE), „Uwagi” (pomijana).
 * Obsługiwane też warianty: jedna kolumna ceny „100–150”, czas „1:30” / „1,5 h” / „1 h 30 min”, „tak/nie”.
 */
import { normalizeText } from "@/lib/clients/search";
import { parseCsv } from "@/lib/catalog/csv";
import { PRICE_UNITS, parseAmount } from "@/lib/catalog/values";

export const SERVICE_NAME_MAX = 120;
export const SERVICES_MAX_ROWS = 1000;

export function parseServicePrice(value: string): number | null | "invalid" {
  const n = parseAmount(value, PRICE_UNITS);
  return typeof n === "number" && n > 100000 ? "invalid" : n;
}

/** „100–150”, „100 - 150 zł”, „od 100”, „120” → {from, to}. Jedna liczba = cena stała (od = do). */
export function parsePriceRange(value: string): { from: number | null; to: number | null } | "invalid" {
  const text = value.trim().toLowerCase().replace(/zł|zl|pln/g, "").trim();
  if (!text) return { from: null, to: null };
  const od = /^od\s*(.+)$/.exec(text);
  if (od) {
    const from = parseServicePrice(od[1]);
    return typeof from === "number" ? { from, to: null } : "invalid";
  }
  const parts = text.split(/\s*[–—-]\s*/);
  if (parts.length > 2) return "invalid";
  const from = parseServicePrice(parts[0]);
  const to = parts.length === 2 ? parseServicePrice(parts[1]) : from;
  if (typeof from !== "number" || typeof to !== "number" || to < from) return "invalid";
  return { from, to };
}

/** Czas w minutach: „90”, „90 min”, „1:30”, „1,5 h”, „1 h 30 min”, „2h”. */
export function parseDuration(value: string): number | null | "invalid" {
  const text = normalizeText(value).replace(/\s+/g, "");
  if (!text) return null;
  let minutes: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)(?:min|m)?$/.exec(text))) minutes = Number(m[1]);
  else if ((m = /^(\d+):([0-5]\d)$/.exec(text))) minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = /^(\d+(?:[.,]\d+)?)(?:h|godz\.?|godziny|godzina|godzin)$/.exec(text))) minutes = Math.round(Number(m[1].replace(",", ".")) * 60);
  else if ((m = /^(\d+)(?:h|godz\.?)(\d+)(?:min|m)?$/.exec(text))) minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes === null) return "invalid";
  return minutes >= 1 && minutes <= 1440 ? minutes : "invalid";
}

/** Pole wyboru z arkusza: TRUE/FALSE, tak/nie, x, 1/0, ✓. Puste = brak informacji. */
export function parseYesNo(value: string): boolean | null | "invalid" {
  const text = normalizeText(value);
  if (!text) return null;
  if (["true", "tak", "t", "x", "1", "✓", "✔", "prawda"].includes(text)) return true;
  if (["false", "nie", "n", "0", "falsz", "-"].includes(text)) return false;
  return "invalid";
}

type ServiceField = "name" | "price_from" | "price_to" | "price_range" | "duration_min" | "with_color";

export function serviceHeaderField(header: string): ServiceField | "ignore" | null {
  const key = normalizeText(header).replace(/[^a-z0-9]/g, "");
  if (!key || key === "uwagi" || key === "notatki" || key === "opis") return "ignore";
  if (key === "usluga" || key === "uslugi" || key === "nazwa" || key === "nazwauslugi") return "name";
  if (key.startsWith("cenaoddo") || key === "cena" || key === "cenazl" || key === "cenapln") return "price_range";
  if (key.startsWith("cenaod")) return "price_from";
  if (key.startsWith("cenado")) return "price_to";
  if (key.startsWith("czas")) return "duration_min";
  if (key.startsWith("zfarba") || key === "farba" || key.startsWith("koloryzacja")) return "with_color";
  return null;
}

export type ServiceImportItem = {
  name: string;
  price_from?: number;
  price_to?: number;
  duration_min?: number;
  with_color?: boolean;
};

export type ParsedServices = {
  fatal?: string;
  items: ServiceImportItem[];
  errors: { row: number; message: string }[];
  warnings: string[];
};

export function parseServicesCsv(text: string): ParsedServices {
  const empty = { items: [], errors: [], warnings: [] };
  const records = parseCsv(text);
  if (records.length === 0) return { ...empty, fatal: "Plik jest pusty." };
  if (records.length - 1 > SERVICES_MAX_ROWS) return { ...empty, fatal: `Za dużo wierszy (maks. ${SERVICES_MAX_ROWS}).` };

  const [header, ...data] = records;
  const columns: Partial<Record<ServiceField, number>> = {};
  const unknown: string[] = [];
  header.forEach((name, index) => {
    const field = serviceHeaderField(name);
    if (field === "ignore") return;
    if (field === null) unknown.push(name.trim());
    else if (columns[field] === undefined) columns[field] = index;
  });
  if (columns.name === undefined) return { ...empty, fatal: "Brak wymaganej kolumny: Usługa." };

  const warnings: string[] = [];
  if (unknown.length > 0) warnings.push(`Pominięto nieznane kolumny: ${unknown.join(", ")}.`);
  const errors: ParsedServices["errors"] = [];
  const byName = new Map<string, { row: number; item: ServiceImportItem }>();
  const cell = (r: string[], i: number | undefined) => (i === undefined ? "" : (r[i] ?? "").trim());

  data.forEach((record, i) => {
    const row = i + 2;
    const name = cell(record, columns.name);
    const problems: string[] = [];
    if (!name) problems.push("brak nazwy usługi");
    else if (name.length > SERVICE_NAME_MAX) problems.push(`nazwa dłuższa niż ${SERVICE_NAME_MAX} znaków`);

    let from: number | null = null;
    let to: number | null = null;
    if (columns.price_from !== undefined || columns.price_to !== undefined) {
      const f = parseServicePrice(cell(record, columns.price_from));
      const t = parseServicePrice(cell(record, columns.price_to));
      if (f === "invalid") problems.push("nieprawidłowa cena od");
      else from = f;
      if (t === "invalid") problems.push("nieprawidłowa cena do");
      else to = t;
    } else if (columns.price_range !== undefined) {
      const range = parsePriceRange(cell(record, columns.price_range));
      if (range === "invalid") problems.push("nieprawidłowa cena (np. 100–150)");
      else ({ from, to } = range);
    }
    if (from !== null && to !== null && to < from) problems.push("cena do niższa niż cena od");

    const duration = parseDuration(cell(record, columns.duration_min));
    if (duration === "invalid") problems.push("nieprawidłowy czas (np. 90 albo 1:30)");
    const color = parseYesNo(cell(record, columns.with_color));
    if (color === "invalid") problems.push("„Z farbą?” – tak/nie (TRUE/FALSE)");

    if (problems.length > 0 || duration === "invalid" || color === "invalid") {
      errors.push({ row, message: problems.join(", ") });
      return;
    }
    const item: ServiceImportItem = { name };
    if (from !== null) item.price_from = from;
    if (to !== null) item.price_to = to;
    if (duration !== null) item.duration_min = duration;
    if (color !== null) item.with_color = color;

    const key = name.toLowerCase();
    const previous = byName.get(key);
    if (previous) {
      warnings.push(`Wiersz ${row} powtarza wiersz ${previous.row} (${name}) – użyto wiersza ${row}.`);
      byName.delete(key);
    }
    byName.set(key, { row, item });
  });

  return { items: [...byName.values()].map((v) => v.item), errors, warnings };
}

export type ExistingService = {
  name: string;
  price_from: number | null;
  price_to: number | null;
  duration_min: number | null;
  with_color: boolean;
};

/** Podgląd: ta sama logika co import_services (puste pola nie nadpisują). */
export function planServices(items: readonly ServiceImportItem[], existing: readonly ExistingService[]) {
  const byName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s]));
  const plan = { created: [] as string[], updated: [] as string[], unchanged: 0 };
  for (const item of items) {
    const current = byName.get(item.name.trim().toLowerCase());
    if (!current) {
      plan.created.push(item.name);
      continue;
    }
    const changed =
      (item.price_from ?? current.price_from) !== current.price_from ||
      (item.price_to ?? current.price_to) !== current.price_to ||
      (item.duration_min ?? current.duration_min) !== current.duration_min ||
      (item.with_color ?? current.with_color) !== current.with_color;
    if (changed) plan.updated.push(current.name);
    else plan.unchanged++;
  }
  return plan;
}

/** „150–250 zł”, „od 80 zł”, „120 zł”, „”. */
export function formatPriceRange(from: number | null, to: number | null): string {
  const f = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  if (from === null && to === null) return "";
  if (from !== null && to !== null) return from === to ? `${f(from)} zł` : `${f(from)}–${f(to)} zł`;
  if (from !== null) return `od ${f(from)} zł`;
  return `do ${f(to as number)} zł`;
}

/** „45 min”, „1 h 30 min”, „2 h”. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
