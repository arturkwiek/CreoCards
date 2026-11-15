export const FULL_NAME_MAX_LENGTH = 120;

/** Powitanie na ekranie głównym – bez imienia bez pustego miejsca („Cześć!”). */
export function greeting(fullName: string | null | undefined): string {
  const name = fullName?.trim();
  return name ? `Cześć, ${name}!` : "Cześć!";
}

/** Czy pokazać zachętę do uzupełnienia imienia. */
export function needsFullName(fullName: string | null | undefined): boolean {
  return !fullName?.trim();
}

/** Imię z formularza: przycięte, bez nadmiarowych spacji; null, gdy puste lub za długie. */
export function parseFullName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > FULL_NAME_MAX_LENGTH) return null;
  return name;
}
