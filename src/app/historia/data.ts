import "server-only";
import type { AuditEntry, FieldSpec } from "@/lib/audit/history";
import { formatPhone } from "@/lib/clients/phone";
import { formatPrice } from "@/lib/catalog/values";
import { formatVisitDate } from "@/lib/visits/time";
import { createClient } from "@/lib/supabase/server";

/** Wpisy historii jednego wiersza (RLS: tylko właścicielka). */
export async function getAuditEntries(tableName: string, rowId: string): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, old_row, created_by, created_at")
    .eq("table_name", tableName)
    .eq("row_id", rowId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((e) => ({ ...e, old_row: (e.old_row ?? null) as Record<string, unknown> | null }));
}

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const consent = (v: unknown) => (typeof v === "string" ? `tak (${formatVisitDate(v)})` : "nie");

export const CLIENT_FIELDS: FieldSpec[] = [
  { key: "full_name", label: "Imię i nazwisko" },
  { key: "phone", label: "Telefon", format: (v) => (typeof v === "string" ? formatPhone(v) : dash(v)) },
  { key: "allergy_status", label: "Alergie", format: (v) => (v === "has" ? "są alergie / uwagi" : "brak znanych alergii") },
  { key: "allergies", label: "Opis alergii" },
  { key: "email", label: "E-mail" },
  { key: "note", label: "Notatka" },
  { key: "rodo_consent_at", label: "Zgoda RODO", format: consent },
  { key: "notifications_consent_at", label: "Zgoda na powiadomienia", format: consent },
  { key: "photo_consent_at", label: "Zgoda na zdjęcia", format: consent },
  { key: "deleted_at", label: "W koszu", format: (v) => (v ? "tak" : "nie") },
];

export function visitFields(serviceNames: Map<string, string>): FieldSpec[] {
  return [
    { key: "service_id", label: "Usługa", format: (v) => (typeof v === "string" ? (serviceNames.get(v) ?? "?") : "—") },
    { key: "visit_at", label: "Data", format: (v) => (typeof v === "string" ? formatVisitDate(v, true) : dash(v)) },
    { key: "price", label: "Cena", format: (v) => (typeof v === "number" ? formatPrice(v) : "—") },
    { key: "deleted_at", label: "W koszu", format: (v) => (v ? "tak" : "nie") },
  ];
}
