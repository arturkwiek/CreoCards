"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";

export type RestoreState = { error?: string; success?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ścieżka powrotu – tylko karta klientki lub wizyta (bez dowolnych przekierowań). */
const SAFE_PATH = /^\/(klientki|wizyty)\/[0-9a-f-]{36}(\/historia)?$/i;

/** Przywrócenie wersji z historii (tylko właścicielka; sprawdza też baza). */
export async function restoreVersion(_prev: RestoreState, formData: FormData): Promise<RestoreState> {
  await requireOwner();
  const auditId = Number(formString(formData, "audit_id"));
  const path = formString(formData, "path");
  if (!Number.isSafeInteger(auditId) || auditId <= 0) return { error: "Nie znaleziono wersji." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_version", { p_audit_id: auditId });
  if (error) {
    return {
      error:
        error.code === "P0002"
          ? "Nie można przywrócić tej wersji – wpis jest w koszu. Najpierw przywróć go z kosza."
          : "Nie udało się przywrócić wersji.",
    };
  }
  if (SAFE_PATH.test(path)) {
    revalidatePath(path);
    revalidatePath(path.replace(/\/historia$/, ""));
  }
  return { success: "Przywrócono wybraną wersję. Poprzedni stan został zapisany w historii." };
}

export type TrashKind = "client" | "visit" | "product" | "photo";

const TABLES: Record<TrashKind, "clients" | "visits" | "products" | "attachments"> = {
  client: "clients",
  visit: "visits",
  product: "products",
  photo: "attachments",
};

/** Przywrócenie z kosza (deleted_at = null) – tylko właścicielka; triggery i RLS pilnują tego w bazie. */
export async function restoreFromTrash(_prev: RestoreState, formData: FormData): Promise<RestoreState> {
  await requireOwner();
  const kind = formString(formData, "kind") as TrashKind;
  const id = formString(formData, "id");
  if (!(kind in TABLES) || !UUID.test(id)) return { error: "Nie znaleziono wpisu." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES[kind])
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error?.code === "23505") {
    return { error: "Nie można przywrócić – w katalogu jest już aktywny produkt o tym odcieniu w tej linii." };
  }
  if (error || !data?.length) return { error: "Nie udało się przywrócić." };

  revalidatePath("/kosz");
  revalidatePath(kind === "product" ? "/katalog" : "/klientki");
  if (kind === "photo") revalidatePath("/zdjecia/bez-zgody");
  return { success: "Przywrócono." };
}
