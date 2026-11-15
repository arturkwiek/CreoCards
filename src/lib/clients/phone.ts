/** Telefon klientki: zapis znormalizowany, wyświetlanie czytelne. Domyślnie numery polskie. */

export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;

/** Same cyfry (tak jak kolumna phone_digits w bazie). */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalizacja wpisanego numeru: „600 123 456” → „+48600123456”, „0048…” → „+48…”,
 * numer z „+” zostaje międzynarodowy. null, gdy cyfr jest za mało lub za dużo.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  let digits = phoneDigits(trimmed);
  let international = trimmed.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international && digits.length === 9) {
    digits = `48${digits}`;
    international = true;
  }
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return null;
  return international ? `+${digits}` : digits;
}

/** Do wyświetlania: polskie numery bez kierunkowego („600 123 456”), inne bez zmian. */
export function formatPhone(stored: string): string {
  const digits = phoneDigits(stored);
  if (stored.startsWith("+48") && digits.length === 11) {
    const local = digits.slice(2);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return stored;
}

/** Adres dla linku tel: (bez spacji). */
export function telHref(stored: string): string {
  return `tel:${stored.startsWith("+") ? "+" : ""}${phoneDigits(stored)}`;
}
