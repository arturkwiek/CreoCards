import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { isDay, todayWarsaw } from "@/lib/schedule/day";
import { getServiceNames } from "../../wizyty/data";
import { getDayAppointments, getTeam } from "../data";
import { DayNav } from "../day-nav";
import { TimeGrid } from "../time-grid";

export const metadata: Metadata = { title: "Grafik – wszyscy – CreoCards" };

async function AllContent({ searchParams }: { searchParams: PageProps<"/grafik/wszyscy">["searchParams"] }) {
  const user = await requireOwner();
  const params = await searchParams;
  const day = typeof params.dzien === "string" && isDay(params.dzien) ? params.dzien : todayWarsaw();
  const [team, items, services] = await Promise.all([getTeam(), getDayAppointments(day, null), getServiceNames()]);
  const busy = new Set(items.filter((a) => a.status !== "odwolana").map((a) => a.staff_id));

  return (
    <>
      <DayNav day={day} base="/grafik/wszyscy" />
      <p className="text-sm text-foreground/60">
        Wolne: {team.filter((m) => !busy.has(m.id)).map((m) => m.name).join(", ") || "nikt"}
      </p>
      <TimeGrid
        wide
        serviceNames={services}
        columns={team.map((m) => ({
          key: m.id,
          title: m.id === user.id ? `${m.name} (ja)` : m.name,
          subtitle: busy.has(m.id) ? undefined : "wolna",
          items: items.filter((a) => a.staff_id === m.id),
          addHref: (t) =>
            `/grafik/nowy?${new URLSearchParams({ dzien: day, godzina: t, ...(m.id !== user.id ? { osoba: m.id } : {}) })}`,
        }))}
      />
    </>
  );
}

export default function AllSchedulePage({ searchParams }: PageProps<"/grafik/wszyscy">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Grafik – wszyscy</h1>
        <Link href="/grafik" className="text-sm text-brand underline-offset-4 hover:underline">
          Mój dzień
        </Link>
      </div>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <AllContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
