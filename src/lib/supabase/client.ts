import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** Klient Supabase dla komponentów klienckich (przeglądarka). */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
