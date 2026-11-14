import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Klient z kluczem service_role – omija RLS. Tylko po stronie serwera i tylko
 * po wcześniejszym sprawdzeniu uprawnień wywołującej osoby (zapytaniem z RLS).
 * Używany do: zaproszeń (auth.admin.inviteUserByEmail) i blokady kont (ban).
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Brak konfiguracji: ustaw SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
