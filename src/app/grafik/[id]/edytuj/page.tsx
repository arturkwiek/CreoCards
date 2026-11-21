import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { dayOf, timeOf } from "@/lib/schedule/day";
import { AppointmentForm } from "../../appointment-form";
import { getAppointment } from "../../data";
import { loadAppointmentFormData } from "../../form-data";

export const metadata: Metadata = { title: "Edycja terminu – CreoCards" };

async function EditAppointment({ params }: { params: PageProps<"/grafik/[id]/edytuj">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const a = await getAppointment(id);
  if (!a || a.deleted_at) notFound();
  if (a.staff_id !== user.id && user.role !== "owner") redirect(`/grafik/${a.id}`);
  const data = await loadAppointmentFormData(user);

  return (
    <AppointmentForm
      initial={{
        id: a.id,
        staff_id: a.staff_id,
        day: dayOf(a.starts_at),
        time: timeOf(a.starts_at),
        duration_min: a.duration_min,
        service_id: a.service_id ?? "",
        client_id: a.client_id,
        note: a.note,
      }}
      {...data}
      cancelHref={`/grafik/${a.id}`}
    />
  );
}

export default function EditAppointmentPage({ params }: PageProps<"/grafik/[id]/edytuj">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold">Edycja terminu</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <EditAppointment params={params} />
      </Suspense>
    </main>
  );
}
