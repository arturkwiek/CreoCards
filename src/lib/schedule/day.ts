/**
 * Grafik: dzień w strefie salonu (Europe/Warsaw), siatka godzin, kolizje i układ bloków terminów.
 * Dzień zapisujemy jako „RRRR-MM-DD” (czas lokalny salonu), godzinę jako „GG:MM”.
 */
import { SALON_TIME_ZONE, fromWarsawLocal, toWarsawLocal } from "@/lib/visits/time";

export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 21;
export const SLOT_MIN = 15;
export const DEFAULT_DURATION = 60;
export const DURATION_MIN = 5;
export const DURATION_MAX = 720;
export const DURATION_PRESETS = [30, 45, 60, 90, 120, 180] as const;
export const NOTE_MAX = 300;

export type AppointmentStatus = "umowiona" | "odbyla_sie" | "odwolana" | "nie_przyszla";

export const STATUSES: readonly AppointmentStatus[] = ["umowiona", "odbyla_sie", "odwolana", "nie_przyszla"];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  umowiona: "Umówiona",
  odbyla_sie: "Odbyła się",
  odwolana: "Odwołana",
  nie_przyszla: "Nie przyszła",
};

/** Terminy, które zajmują czas (odwołane i nieobecności nie kolidują). */
export const isBlocking = (status: AppointmentStatus) => status === "umowiona" || status === "odbyla_sie";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDay(value: string): boolean {
  return DAY.test(value) && fromWarsawLocal(value) !== null;
}

export function isTime(value: string): boolean {
  return TIME.test(value);
}

/** Ścieżka dnia w grafiku (bez danych osobowych: dzień i id osoby z zespołu). */
export function dayHref(day: string, staffId: string, meId: string): string {
  return `/grafik?dzien=${day}${staffId !== meId ? `&osoba=${staffId}` : ""}`;
}

/** Dzisiejszy dzień w Warszawie. */
export function todayWarsaw(now: Date = new Date()): string {
  return toWarsawLocal(now).slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const [, y, m, d] = DAY.exec(day)!;
  return new Date(Date.UTC(+y, +m - 1, +d + n)).toISOString().slice(0, 10);
}

/** Zakres dnia [od, do) jako ISO (UTC) – do zapytań. Północ w Polsce nigdy nie wypada w zmianie czasu. */
export function dayRange(day: string): { from: string; to: string } {
  return {
    from: fromWarsawLocal(`${day}T00:00`)!.toISOString(),
    to: fromWarsawLocal(`${addDays(day, 1)}T00:00`)!.toISOString(),
  };
}

/** Początek terminu: dzień + godzina (Warszawa) → ISO albo null. */
export function startsAt(day: string, time: string): string | null {
  if (!isDay(day) || !isTime(time)) return null;
  return fromWarsawLocal(`${day}T${time}`)?.toISOString() ?? null;
}

export function dayOf(iso: string): string {
  return toWarsawLocal(iso).slice(0, 10);
}

export function timeOf(iso: string): string {
  return toWarsawLocal(iso).slice(11, 16);
}

/** Minuta dnia (Warszawa) – pozycja w siatce. */
export function minuteOfDay(iso: string): number {
  const t = timeOf(iso);
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

/** Godzina końca „GG:MM”. */
export function endTime(iso: string, durationMin: number): string {
  return timeOf(new Date(new Date(iso).getTime() + durationMin * 60_000).toISOString());
}

const dayLabel = new Intl.DateTimeFormat("pl-PL", {
  timeZone: SALON_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** „sobota, 21 listopada” */
export function formatDay(day: string): string {
  return dayLabel.format(fromWarsawLocal(day)!);
}

export type Slot = { id: string; starts_at: string; duration_min: number; status: AppointmentStatus };

const startMs = (s: Pick<Slot, "starts_at">) => new Date(s.starts_at).getTime();
const endMs = (s: Pick<Slot, "starts_at" | "duration_min">) => startMs(s) + s.duration_min * 60_000;

export function overlaps(a: Pick<Slot, "starts_at" | "duration_min">, b: Pick<Slot, "starts_at" | "duration_min">): boolean {
  return startMs(a) < endMs(b) && startMs(b) < endMs(a);
}

/** Terminy tej samej osoby nakładające się na nowy/zmieniany termin (bez niego samego). */
export function findConflicts<T extends Slot>(
  candidate: Pick<Slot, "starts_at" | "duration_min"> & { id?: string },
  others: readonly T[],
): T[] {
  return others.filter((o) => o.id !== candidate.id && isBlocking(o.status) && overlaps(candidate, o));
}

export type Block<T> = {
  item: T;
  /** Minuty od początku siatki. */
  top: number;
  height: number;
  /** Kolumna w grupie nakładających się terminów i liczba kolumn grupy. */
  col: number;
  cols: number;
};

/**
 * Układ dnia: zakres siatki (domyślnie 7:00–21:00, poszerzany o terminy poza nim) i bloki;
 * nakładające się terminy stają obok siebie.
 */
export function layoutDay<T extends Slot>(items: readonly T[]): { startMin: number; endMin: number; blocks: Block<T>[] } {
  const sorted = [...items].sort((a, b) => startMs(a) - startMs(b) || b.duration_min - a.duration_min);
  let startMin = DAY_START_HOUR * 60;
  let endMin = DAY_END_HOUR * 60;
  for (const it of sorted) {
    const s = minuteOfDay(it.starts_at);
    startMin = Math.min(startMin, Math.floor(s / 60) * 60);
    endMin = Math.min(24 * 60, Math.max(endMin, Math.ceil((s + it.duration_min) / 60) * 60));
  }

  const blocks: Block<T>[] = [];
  let group: Block<T>[] = [];
  let groupEnd = -Infinity;
  let colEnds: number[] = [];
  const closeGroup = () => {
    for (const b of group) b.cols = colEnds.length;
    group = [];
    colEnds = [];
  };
  for (const it of sorted) {
    if (startMs(it) >= groupEnd) {
      closeGroup();
      groupEnd = -Infinity;
    }
    let col = colEnds.findIndex((end) => end <= startMs(it));
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(endMs(it));
    } else colEnds[col] = endMs(it);
    const s = minuteOfDay(it.starts_at);
    const block: Block<T> = {
      item: it,
      top: s - startMin,
      height: Math.max(SLOT_MIN, Math.min(it.duration_min, endMin - s)),
      col,
      cols: 1,
    };
    group.push(block);
    blocks.push(block);
    groupEnd = Math.max(groupEnd, endMs(it));
  }
  closeGroup();
  return { startMin, endMin, blocks };
}

/** Godziny siatki do wyboru („07:00”, „07:15”, …, „20:45”). */
export function timeOptions(): string[] {
  const out: string[] = [];
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MIN) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}
