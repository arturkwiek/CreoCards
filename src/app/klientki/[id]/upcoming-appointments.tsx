import Link from "next/link";
import { getClientAppointments } from "@/app/grafik/data";
import { getServiceNames, getTeamNames } from "@/app/wizyty/data";
import { STATUS_LABELS, dayRange, endTime, todayWarsaw } from "@/lib/schedule/day";
import { formatVisitDate } from "@/lib/visits/time";

/** Nadchodzące terminy klientki (od dziś) – na karcie klientki. */
export async function UpcomingAppointments({ clientId }: { clientId: string }) {
  const items = (await getClientAppointments(clientId, dayRange(todayWarsaw()).from)).filter((a) => a.status !== "odbyla_sie");
  if (items.length === 0) return null;
  const [services, names] = await Promise.all([getServiceNames(), getTeamNames()]);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Terminy</h2>
      <ul className="flex flex-col gap-2">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/grafik/${a.id}`} className="flex flex-col rounded-xl border border-brand/30 px-4 py-3 active:bg-foreground/5">
              <span className="font-medium">
                {formatVisitDate(a.starts_at, true)}–{endTime(a.starts_at, a.duration_min)}
              </span>
              <span className="text-sm text-foreground/60">
                {[a.service_id ? services.get(a.service_id) : "", names.get(a.staff_id), a.status !== "umowiona" ? STATUS_LABELS[a.status] : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
