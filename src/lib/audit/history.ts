/**
 * Historia zmian: kolejne wersje wiersza z audit_log (old_row = stan sprzed zmiany).
 * Wersja N „przed” = old_row wpisu N, „po” = old_row następnego (nowszego) wpisu albo bieżący wiersz.
 */

export type AuditAction = "update" | "delete" | "restore" | "recipe_snapshot" | "export";

export type AuditEntry = {
  id: number;
  action: AuditAction;
  old_row: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

export type FieldSpec = { key: string; label: string; format?: (value: unknown) => string };

export type Change = { key: string; label: string; before: string; after: string };

export type Version = {
  auditId: number;
  action: AuditAction;
  createdAt: string;
  createdBy: string | null;
  /** Stan sprzed zmiany – to on jest przywracany. */
  snapshot: Record<string, unknown>;
  changes: Change[];
};

const plain = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

/** Różnice w wybranych polach (porównanie wartości, nie formatu). */
export function diffFields(
  fields: readonly FieldSpec[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Change[] {
  return fields
    .filter((f) => JSON.stringify(before[f.key] ?? null) !== JSON.stringify(after[f.key] ?? null))
    .map((f) => {
      const format = f.format ?? plain;
      return { key: f.key, label: f.label, before: format(before[f.key]), after: format(after[f.key]) };
    });
}

/**
 * Wersje od najnowszej. `entries` w dowolnej kolejności; `current` – bieżący stan wiersza.
 * Wpisy bez zmian w pokazywanych polach (np. tylko techniczne kolumny) są pomijane.
 */
export function buildVersions(
  fields: readonly FieldSpec[],
  entries: readonly AuditEntry[],
  current: Record<string, unknown>,
): Version[] {
  const sorted = [...entries].filter((e) => e.old_row).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  const versions: Version[] = [];
  sorted.forEach((entry, i) => {
    const before = entry.old_row as Record<string, unknown>;
    const after = (sorted[i + 1]?.old_row as Record<string, unknown> | undefined) ?? current;
    const changes = diffFields(fields, before, after);
    if (changes.length === 0 && entry.action === "update") return;
    versions.push({
      auditId: entry.id,
      action: entry.action,
      createdAt: entry.created_at,
      createdBy: entry.created_by,
      snapshot: before,
      changes,
    });
  });
  return versions.reverse();
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  update: "Zmiana",
  delete: "Usunięcie",
  restore: "Przywrócenie z kosza",
  recipe_snapshot: "Zmiana receptury",
  export: "Eksport danych",
};
