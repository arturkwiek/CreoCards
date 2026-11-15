/**
 * Data wizyty w strefie salonu (Europe/Warsaw), niezależnie od strefy serwera (Vercel = UTC).
 * Pole formularza `datetime-local` ma postać „RRRR-MM-DDTGG:MM” bez strefy – traktujemy ją jako czas w Warszawie.
 */
export const SALON_TIME_ZONE = "Europe/Warsaw";

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SALON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function warsawParts(date: Date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** Przesunięcie Warszawy względem UTC w danej chwili (ms). */
function offsetMs(date: Date): number {
  const p = warsawParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (UTC) → „RRRR-MM-DDTGG:MM” w Warszawie. */
export function toWarsawLocal(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const p = warsawParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

/** „RRRR-MM-DDTGG:MM” (lub sama data) w Warszawie → Date (UTC) albo null. */
export function fromWarsawLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, h = "12", min = "00"] = match;
  const guess = Date.UTC(+y, +m - 1, +d, +h, +min);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== +y || check.getUTCMonth() !== +m - 1 || check.getUTCDate() !== +d || +h > 23 || +min > 59) {
    return null;
  }
  // Dwa przybliżenia wystarczają także przy zmianie czasu.
  let result = guess - offsetMs(new Date(guess));
  result = guess - offsetMs(new Date(result));
  return new Date(result);
}

const dateFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: SALON_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: SALON_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatVisitDate(iso: string, withTime = false): string {
  return (withTime ? dateTimeFormat : dateFormat).format(new Date(iso));
}
