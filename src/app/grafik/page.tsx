import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/auth/session";
import { isDay, todayWarsaw } from "@/lib/schedule/day";
import { getServiceNames } from "../wizyty/data";
import { getDayAppointments, getTeam } from "./data";
import { DayNav } from "./day-nav";
import { TimeGrid } from "./time-grid";

export const metadata: Metadata = { title: "Grafik – CreoCards" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function DayContent({ searchParams }: { searchParams: PageProps<"/grafik">["searchParams"] }) {
  const user = await requireUser();
  const params = await searchParams;
  const day = isDay(one(params.dzien)) ? one(params.dzien) : todayWarsaw();
  const team = await getTeam();
  // Cudzy dzień: podgląd dla każdej osoby z zespołu (do odczytu), dodawanie – właścicielka.
  const person = team.find((m) => m.id === one(params.osoba)) ?? team.find((m) => m.id === user.id);
  const staffId = person?.id ?? user.id;
  const [items, services] = await Promise.all([getDayAppointments(day, staffId), getServiceNames()]);
  const canAdd = staffId === user.id || user.role === "owner";
  const extra: Record<string, string> = staffId !== user.id ? { osoba: staffId } : {};
  const addHref = (time?: string) =>
    `/grafik/nowy?${new URLSearchParams({ dzien: day, ...(time ? { godzina: time } : {}), ...extra })}`;

  return (
    <>
      <nav aria-label="Osoba" className="flex flex-wrap gap-2">
        {team.map((m) => (
          <Link
            key={m.id}
            href={`/grafik?${new URLSearchParams({ dzien: day, ...(m.id !== user.id ? { osoba: m.id } : {}) })}`}
            aria-current={m.id === staffId ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              m.id === staffId ? "border-brand bg-brand text-white" : "border-foreground/20"
            }`}
          >
            {m.id === user.id ? "Ja" : m.name}
          </Link>
        ))}
        {user.role === "owner" && (
          <Link href={`/grafik/wszyscy?dzien=${day}`} className="rounded-full border border-foreground/20 px-3.5 py-1.5 text-sm font-medium">
            Wszyscy
          </Link>
        )}
      </nav>
      <DayNav day={day} base="/grafik" extra={extra} />
      <h2 className="text-lg font-semibold">
        {staffId === user.id ? "Mój dzień" : person?.name}
        <span className="ml-2 text-sm font-normal text-foreground/60">
          {items.length === 0 ? "brak terminów – wolna" : `terminy: ${items.filter((a) => a.status !== "odwolana").length}`}
        </span>
      </h2>
      <TimeGrid
        columns={[{ key: staffId, items, addHref: canAdd ? (t) => addHref(t) : null }]}
        serviceNames={services}
      />
      {canAdd && (
        <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-5 pt-6">
          <div className="mx-auto max-w-md">
            <Link href={addHref()} className={buttonStyles.primary}>
              + Dodaj termin
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

export default function SchedulePage({ searchParams }: PageProps<"/grafik">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Grafik</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <DayContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
