import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limit nieudanych logowań (na login i na IP) – liczy baza (login_throttled), zapisuje record_login_attempt.
 * W bazie tylko skróty HMAC z sekretem LOGIN_RATE_SECRET: ani login, ani IP nie są przechowywane jawnie.
 */

export const THROTTLED_MESSAGE = "Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za 15 minut.";

function secret(): string {
  const value = process.env.LOGIN_RATE_SECRET;
  if (!value || value.length < 16) throw new Error("Brak konfiguracji LOGIN_RATE_SECRET");
  return value;
}

export function hashKey(kind: "login" | "ip", value: string, key: string = secret()): string {
  return createHmac("sha256", key).update(`${kind}:${value}`).digest("hex");
}

/** IP klientki: pierwszy adres z x-forwarded-for (Vercel), potem x-real-ip. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export type AttemptKeys = { loginHash: string; ipHash: string };

export function attemptKeys(identifier: string, ip: string): AttemptKeys {
  const key = secret();
  return { loginHash: hashKey("login", identifier, key), ipHash: hashKey("ip", ip, key) };
}

export async function isThrottled(keys: AttemptKeys): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("login_throttled", {
    p_login_hash: keys.loginHash,
    p_ip_hash: keys.ipHash,
  });
  // Błąd bazy nie blokuje logowania (Supabase Auth ma własny limit), ale też go nie omija w ciszy.
  if (error) console.error("login_throttled: błąd sprawdzenia limitu");
  return data === true;
}

export async function recordAttempt(keys: AttemptKeys, success: boolean): Promise<void> {
  const { error } = await createAdminClient().rpc("record_login_attempt", {
    p_login_hash: keys.loginHash,
    p_ip_hash: keys.ipHash,
    p_success: success,
  });
  if (error) console.error("record_login_attempt: błąd zapisu próby");
}
