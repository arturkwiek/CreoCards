import "server-only";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Eksport tylko dla aktywnej właścicielki – w route handlerze zamiast przekierowania zwracamy 403. */
export async function ownerOnly(): Promise<Response | null> {
  const session = await getSession();
  if (session.status !== "active" || session.user.role !== "owner") {
    return new Response("Brak dostępu", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

/** Zapis eksportu w historii (kto i co). Gdy się nie uda – eksport nie jest wydawany. */
export async function logExport(scope: "all" | "client", rowId?: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_export", { p_scope: scope, p_row_id: rowId });
  return !error;
}

/** Plik do pobrania; nazwa bez danych osobowych. */
export function fileResponse(body: Uint8Array, fileName: string, contentType: string): Response {
  return new Response(body as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}
