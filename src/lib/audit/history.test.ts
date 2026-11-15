import { describe, expect, it } from "vitest";
import { buildVersions, diffFields, type AuditEntry, type FieldSpec } from "./history";

// Wyłącznie dane testowe.
const fields: FieldSpec[] = [
  { key: "phone", label: "Telefon" },
  { key: "allergies", label: "Opis alergii" },
  { key: "allergy_status", label: "Alergie", format: (v) => (v === "has" ? "są" : "brak") },
];

const entry = (id: number, at: string, old_row: Record<string, unknown>, action: AuditEntry["action"] = "update"): AuditEntry => ({
  id,
  action,
  old_row,
  created_by: "u1",
  created_at: at,
});

describe("diffFields", () => {
  it("tylko zmienione pola, z formatowaniem i pustymi wartościami", () => {
    expect(
      diffFields(fields, { phone: "600", allergies: "", allergy_status: "none" }, { phone: "600", allergies: "PPD", allergy_status: "has" }),
    ).toEqual([
      { key: "allergies", label: "Opis alergii", before: "—", after: "PPD" },
      { key: "allergy_status", label: "Alergie", before: "brak", after: "są" },
    ]);
  });
});

describe("buildVersions", () => {
  const current = { phone: "700", allergies: "PPD, lateks", allergy_status: "has", updated_at: "x" };
  const entries = [
    entry(2, "2026-11-02T10:00:00Z", { phone: "600", allergies: "PPD", allergy_status: "has" }),
    entry(1, "2026-11-01T10:00:00Z", { phone: "600", allergies: "", allergy_status: "none" }),
    // Zmiana tylko kolumny technicznej – pominięta.
    entry(3, "2026-11-03T10:00:00Z", { phone: "700", allergies: "PPD, lateks", allergy_status: "has", updated_at: "y" }),
  ];

  it("od najnowszej; „po” = następna wersja albo bieżący stan", () => {
    const versions = buildVersions(fields, entries, current);
    expect(versions.map((v) => v.auditId)).toEqual([2, 1]);
    expect(versions[0].changes).toEqual([
      { key: "phone", label: "Telefon", before: "600", after: "700" },
      { key: "allergies", label: "Opis alergii", before: "PPD", after: "PPD, lateks" },
    ]);
    expect(versions[1].changes.map((c) => c.key)).toEqual(["allergies", "allergy_status"]);
    expect(versions[1].snapshot).toEqual({ phone: "600", allergies: "", allergy_status: "none" });
  });

  it("usunięcie i przywrócenie z kosza zostają w historii nawet bez zmian pól", () => {
    const versions = buildVersions(fields, [entry(5, "2026-11-04T10:00:00Z", { ...current }, "delete")], current);
    expect(versions).toHaveLength(1);
    expect(versions[0].action).toBe("delete");
  });
});
