import Link from "next/link";
import { endTime, layoutDay, minuteOfDay, timeOf } from "@/lib/schedule/day";
import type { Appointment } from "./data";

/** Wysokość minuty w siatce (px) – godzina = 72 px. */
const PX = 1.2;

export type GridColumn = {
  key: string;
  title?: string;
  /** Np. „wolna”, gdy osoba nie ma terminów. */
  subtitle?: string;
  items: Appointment[];
  /** Link „dodaj termin o tej godzinie” albo null, gdy osoba nie może dodawać. */
  addHref: ((time: string) => string) | null;
};

const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const STATUS_CLASS: Record<Appointment["status"], string> = {
  umowiona: "border-brand/50 bg-brand/10",
  odbyla_sie: "border-green-700/40 bg-green-50 dark:bg-green-950",
  odwolana: "border-foreground/20 bg-foreground/5 text-foreground/50 line-through",
  nie_przyszla: "border-amber-600/50 bg-amber-50 text-foreground/60 dark:bg-amber-950",
};

/** Dzień godzina po godzinie: oś czasu i kolumny (jedna osoba albo cały zespół). */
export function TimeGrid({
  columns,
  serviceNames,
  wide = false,
}: {
  columns: GridColumn[];
  serviceNames: Map<string, string>;
  /** Widok wszystkich: kolumny o stałej szerokości, przewijane w bok. */
  wide?: boolean;
}) {
  const all = columns.flatMap((c) => c.items);
  const { startMin, endMin } = layoutDay(all);
  const height = (endMin - startMin) * PX;
  const hours: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hours.push(m);

  return (
    <div className="flex gap-1">
      <div className="relative w-11 shrink-0" style={{ height: height + (wide ? 28 : 0) }} aria-hidden>
        {hours.map((m) => (
          <span
            key={m}
            className="absolute right-1 -translate-y-1/2 text-xs text-foreground/50"
            style={{ top: (m - startMin) * PX + (wide ? 28 : 0) }}
          >
            {hh(m)}
          </span>
        ))}
      </div>
      <div className={`flex min-w-0 flex-1 gap-1 ${wide ? "overflow-x-auto" : ""}`}>
        {columns.map((col) => {
          const { blocks } = layoutDay(col.items);
          return (
            <section key={col.key} aria-label={col.title} className={wide ? "w-36 shrink-0" : "min-w-0 flex-1"}>
              {wide && (
                <h2 className="h-7 truncate text-sm font-semibold">
                  {col.title}
                  {col.subtitle && <span className="ml-1 font-normal text-green-700 dark:text-green-400">{col.subtitle}</span>}
                </h2>
              )}
              <div className="relative" style={{ height }}>
                {hours.map((m) =>
                  col.addHref ? (
                    <Link
                      key={m}
                      href={col.addHref(hh(m))}
                      aria-label={`Dodaj termin ${hh(m)}${col.title ? ` – ${col.title}` : ""}`}
                      className="absolute inset-x-0 border-t border-foreground/10 active:bg-brand/10"
                      style={{ top: (m - startMin) * PX, height: 60 * PX }}
                    />
                  ) : (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-foreground/10"
                      style={{ top: (m - startMin) * PX, height: 60 * PX }}
                    />
                  ),
                )}
                {blocks.map(({ item: a, col: c, cols }) => {
                  const top = (minuteOfDay(a.starts_at) - startMin) * PX;
                  const h = Math.max(18, a.duration_min * PX - 2);
                  const service = a.service_id ? serviceNames.get(a.service_id) : "";
                  return (
                    <Link
                      key={a.id}
                      href={`/grafik/${a.id}`}
                      className={`absolute overflow-hidden rounded-lg border px-1.5 py-0.5 text-xs leading-tight ${STATUS_CLASS[a.status]}`}
                      style={{ top, height: h, left: `${(c / cols) * 100}%`, width: `calc(${100 / cols}% - 2px)` }}
                    >
                      <span className="font-semibold">
                        {timeOf(a.starts_at)}–{endTime(a.starts_at, a.duration_min)}
                      </span>{" "}
                      <span className="font-medium">{a.client?.full_name ?? "Klientka"}</span>
                      {a.client?.allergy_status === "unknown" && (
                        <span className="ml-1 rounded bg-red-600 px-1 text-[10px] font-semibold text-white no-underline">Alergie?</span>
                      )}
                      {a.client?.allergy_status === "has" && (
                        <span className="ml-1 rounded bg-red-600 px-1 text-[10px] font-semibold text-white no-underline">Alergie</span>
                      )}
                      {service && <span className="block truncate text-foreground/70">{service}</span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

