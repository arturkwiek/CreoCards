import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/auth/session";
import { formatPhone, telHref } from "@/lib/clients/phone";
import { STATUSES, STATUS_LABELS, dayHref, dayOf, endTime, formatDay, timeOf } from "@/lib/schedule/day";
import { formatDuration } from "@/lib/services/import";
import { AllergyNotice } from "@/app/klientki/allergy-notice";
import { getClient } from "@/app/klientki/data";
import { getServiceNames, getTeamNames } from "@/app/wizyty/data";
import { setAppointmentStatus } from "../actions";
import { getAppointment } from "../data";
import { DeleteAppointmentButton } from "./delete-appointment-button";

// Tytuł bez imienia klientki.
export const metadata: Metadata = { title: "Termin – CreoCards" };

async function AppointmentContent({ params }: { params: PageProps<"/grafik/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const a = await getAppointment(id);
  if (!a) notFound();
  const [client, services, names] = await Promise.all([getClient(a.client_id), getServiceNames(), getTeamNames()]);
  const canEdit = !a.deleted_at && (a.staff_id === user.id || user.role === "owner");
  const service = a.service_id ? services.get(a.service_id) : undefined;
  const day = dayOf(a.starts_at);

  return (
    <>
      <Link href={dayHref(day, a.staff_id, user.id)} className="text-sm text-brand underline-offset-4 hover:underline">
        ← Grafik
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">
          {timeOf(a.starts_at)}–{endTime(a.starts_at, a.duration_min)} · {client?.full_name ?? "Klientka"}
        </h1>
        <p className="text-sm text-foreground/60 first-letter:uppercase">
          {formatDay(day)} · {formatDuration(a.duration_min)} · {names.get(a.staff_id) ?? "—"}
        </p>
        {service && <p className="mt-1 font-medium">{service}</p>}
        {a.note && <p className="mt-1 whitespace-pre-wrap text-sm">{a.note}</p>}
        {a.deleted_at && <p className="mt-1 text-sm text-red-700 dark:text-red-400">Termin jest w koszu.</p>}
      </div>

      {client && <AllergyNotice status={client.allergy_status} allergies={client.allergies} />}

      {canEdit && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Status: {STATUS_LABELS[a.status]}</legend>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <form key={s} action={setAppointmentStatus}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="status" value={s} />
                <button
                  type="submit"
                  aria-pressed={a.status === s}
                  className={`min-h-11 w-full rounded-xl border px-3 py-2 text-base font-medium ${
                    a.status === s ? "border-brand bg-brand text-white" : "border-foreground/20"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              </form>
            ))}
          </div>
        </fieldset>
      )}
      {!canEdit && !a.deleted_at && <p className="text-sm text-foreground/60">Status: {STATUS_LABELS[a.status]}</p>}

      {a.visit_id ? (
        <Link href={`/wizyty/${a.visit_id}`} className={buttonStyles.primary}>
          Zobacz wizytę
        </Link>
      ) : (
        canEdit &&
        client && (
          <Link href={`/klientki/${client.id}/wizyta/nowa?termin=${a.id}`} className={buttonStyles.primary}>
            Nowa wizyta
          </Link>
        )
      )}

      {client && (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/klientki/${client.id}`} className={buttonStyles.secondary}>
            Karta klientki
          </Link>
          <a href={telHref(client.phone)} className={buttonStyles.secondary}>
            {formatPhone(client.phone)}
          </a>
        </div>
      )}

      {canEdit && (
        <Link href={`/grafik/${a.id}/edytuj`} className={buttonStyles.secondary}>
          Edytuj termin
        </Link>
      )}
      {user.role === "owner" && (
        <Link href={`/grafik/${a.id}/historia`} className={buttonStyles.secondary}>
          Historia zmian
        </Link>
      )}
      {canEdit && <DeleteAppointmentButton id={a.id} />}
    </>
  );
}

export default function AppointmentPage({ params }: PageProps<"/grafik/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <AppointmentContent params={params} />
      </Suspense>
    </main>
  );
}
