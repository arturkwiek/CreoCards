/**
 * Wyszukiwanie klientek po imieniu, nazwisku lub fragmencie telefonu – w przeglądarce,
 * bez wysyłania frazy w URL-u. Bez frazy: kolejność ostatniej zmiany (updated_at malejąco).
 * Z frazą: najlepsze dopasowania na górze, przy remisie – ostatnio zmienione.
 */

export type SearchableClient = {
  full_name: string;
  phone_digits: string;
  updated_at: string;
};

/** Małe litery, bez polskich znaków i akcentów („Łucja Żak” → „lucja zak”). */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lokalna część polskiego numeru (bez 48), do dopasowań „od początku”. */
function localDigits(phoneDigits: string): string {
  return phoneDigits.length === 11 && phoneDigits.startsWith("48") ? phoneDigits.slice(2) : phoneDigits;
}

function tokenScore(token: string, nameWords: string[], name: string, phone: string): number {
  if (/^\d+$/.test(token)) {
    const local = localDigits(phone);
    if (local === token || phone === token) return 100;
    if (local.startsWith(token) || phone.startsWith(token)) return 60;
    if (phone.includes(token)) return 40;
    return 0;
  }
  if (nameWords.some((w) => w === token)) return 50;
  if (name.startsWith(token)) return 45;
  if (nameWords.some((w) => w.startsWith(token))) return 35;
  if (name.includes(token)) return 15;
  return 0;
}

/** Wynik dopasowania (0 = brak). Każde słowo frazy musi pasować. */
export function matchScore(client: SearchableClient, query: string): number {
  const tokens = normalizeText(query)
    .split(" ")
    .map((t) => (/^[\d\s()+-]+$/.test(t) ? t.replace(/\D/g, "") : t))
    .filter(Boolean);
  if (tokens.length === 0) return 0;

  const name = normalizeText(client.full_name);
  const nameWords = name.split(" ");
  let total = 0;
  for (const token of tokens) {
    const score = tokenScore(token, nameWords, name, client.phone_digits);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

const byUpdatedDesc = (a: SearchableClient, b: SearchableClient) =>
  b.updated_at.localeCompare(a.updated_at);

export function filterClients<T extends SearchableClient>(clients: readonly T[], query: string): T[] {
  // Numer wpisany ze spacjami („600 12”) traktujemy jako jeden ciąg cyfr.
  const q = /^[\d\s()+-]+$/.test(query.trim()) ? query.replace(/\D/g, "") : query;
  if (!normalizeText(q)) return [...clients].sort(byUpdatedDesc);

  return clients
    .map((client) => ({ client, score: matchScore(client, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || byUpdatedDesc(a.client, b.client))
    .map((r) => r.client);
}
