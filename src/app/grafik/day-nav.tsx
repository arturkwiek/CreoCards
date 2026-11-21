import Link from "next/link";
import { addDays, formatDay, todayWarsaw } from "@/lib/schedule/day";

/** ← dzień →, „Dziś” i wybór daty (formularz GET – w adresie tylko dzień i id osoby z zespołu). */
export function DayNav({ day, base, extra = {} }: { day: string; base: string; extra?: Record<string, string> }) {
  const href = (d: string) => `${base}?${new URLSearchParams({ dzien: d, ...extra })}`;
  const today = todayWarsaw();
  const nav = "flex h-11 min-w-11 items-center justify-center rounded-xl border border-foreground/20 px-3 text-base font-semibold";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Link href={href(addDays(day, -1))} aria-label="Poprzedni dzień" className={nav}>
          ←
        </Link>
        <p className="flex-1 text-center font-semibold first-letter:uppercase">{formatDay(day)}</p>
        <Link href={href(addDays(day, 1))} aria-label="Następny dzień" className={nav}>
          →
        </Link>
      </div>
      <form action={base} className="flex items-center gap-2">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {day !== today && (
          <Link href={href(today)} className={nav}>
            Dziś
          </Link>
        )}
        <label htmlFor="grafik-day" className="sr-only">
          Wybierz dzień
        </label>
        <input
          id="grafik-day"
          type="date"
          name="dzien"
          defaultValue={day}
          className="h-11 min-w-0 flex-1 rounded-xl border border-foreground/20 bg-background px-3 text-base"
        />
        <button type="submit" className={nav}>
          Pokaż
        </button>
      </form>
    </div>
  );
}
