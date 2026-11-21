import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/catalog/form";
import { DEFAULT_DURATION, dayHref, isDay, isTime, todayWarsaw } from "@/lib/schedule/day";
import { AppointmentForm } from "../appointment-form";
import { getTeam } from "../data";
import { loadAppointmentFormData } from "../form-data";

export const metadata: Metadata = { title: "Nowy termin – CreoCards" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function NewAppointment({ searchParams }: { searchParams: PageProps<"/grafik/nowy">["searchParams"] }) {
  const user = await requireUser();
  const params = await searchParams;
  const day = isDay(one(params.dzien)) ? one(params.dzien) : todayWarsaw();
  const time = isTime(one(params.godzina)) ? one(params.godzina) : "10:00";
  // Termin innej osobie – tylko właścicielka; uczennica zawsze dla siebie.
  const team = await getTeam();
  const asked = one(params.osoba);
  const staffId = user.role === "owner" && team.some((m) => m.id === asked) ? asked : user.id;
  const clientId = isUuid(one(params.klientka)) ? one(params.klientka) : "";
  const data = await loadAppointmentFormData(user);

  return (
    <AppointmentForm
      initial={{
        staff_id: staffId,
        day,
        time,
        duration_min: DEFAULT_DURATION,
        service_id: "",
        client_id: data.clients.some((c) => c.id === clientId) ? clientId : "",
        note: "",
      }}
      {...data}
      cancelHref={clientId ? `/klientki/${clientId}` : dayHref(day, staffId, user.id)}
    />
  );
}

export default function NewAppointmentPage({ searchParams }: PageProps<"/grafik/nowy">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold">Nowy termin</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <NewAppointment searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
