import type { Database } from "@/lib/supabase/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Właścicielka",
  apprentice: "Uczennica",
};

export const PASSWORD_MIN_LENGTH = 8;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Zwraca komunikat błędu albo null, gdy hasło spełnia wymagania (min. 8 znaków, litera i cyfra). */
export function validatePassword(password: string, confirmation?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`;
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return "Hasło musi zawierać literę i cyfrę.";
  }
  if (confirmation !== undefined && password !== confirmation) {
    return "Hasła nie są takie same.";
  }
  return null;
}

export function parseRole(value: unknown): UserRole | null {
  return value === "owner" || value === "apprentice" ? value : null;
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
