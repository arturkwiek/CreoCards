import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { toWarsawLocal } from "@/lib/visits/time";
import { getAppointment } from "@/app/grafik/data";
import { loadVisitFormData } from "@/app/wizyty/form-data";
import { VisitForm } from "@/app/wizyty/visit-form";
import { AllergyNotice } from "../../../allergy-notice";
import { getClient } from "../../../data";

// Tytuł bez imienia klientki.
export const metadata: Metadata = { title: "Nowa wizyta – CreoCards" };

const DAY_MS = 24 * 60 * 60 * 1000;

async function NewVisitContent({
  params,
  searchParams,
}: {
  params: PageProps<"/klientki/[id]/wizyta/nowa">["params"];
  searchParams: PageProps<"/klientki/[id]/wizyta/nowa">["searchParams"];
}) {
  const { id } = await params;
  const { termin } = await searchParams;
  const user = await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const [{ services, products, lastRecipe }, found] = await Promise.all([
    loadVisitFormData(client.id),
    typeof termin === "string" ? getAppointment(termin) : null,
  ]);
  // „Nowa wizyta” z terminu: ta sama klientka, termin bez wizyty, osoba z terminu albo właścicielka.
  const appointment =
    found &&
    found.client_id === client.id &&
    !found.visit_id &&
    !found.deleted_at &&
    (found.staff_id === user.id || user.role === "owner")
      ? found
      : null;
  // Data wizyty z terminu (wizyta nie może być w przyszłości – wtedy teraz).
  const now = new Date();
  const visitAt =
    appointment && new Date(appointment.starts_at).getTime() <= now.getTime() + DAY_MS ? appointment.starts_at : now;

  return (
    <>
      <Link href={`/klientki/${client.id}`} className="text-sm text-brand underline-offset-4 hover:underline">
        ← {client.full_name}
      </Link>
      <h1 className="text-2xl font-semibold">Nowa wizyta</h1>
      {appointment && <p className="text-sm text-foreground/60">Z terminu w grafiku – po zapisie termin dostanie status „Odbyła się”.</p>}
      <AllergyNotice status={client.allergy_status} allergies={client.allergies} />
      <VisitForm
        clientId={client.id}
        services={services}
        products={products}
        lastRecipe={lastRecipe}
        initial={{
          service_id: appointment?.service_id ?? "",
          visit_at: toWarsawLocal(visitAt),
          price: "",
          recipe: { note: "", mixes: [] },
        }}
        cancelHref={appointment ? `/grafik/${appointment.id}` : `/klientki/${client.id}`}
        appointmentId={appointment?.id}
        allergyUnknown={client.allergy_status === "unknown"}
      />
    </>
  );
}

export default function NewVisitPage({ params, searchParams }: PageProps<"/klientki/[id]/wizyta/nowa">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <NewVisitContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
