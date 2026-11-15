import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { toWarsawLocal } from "@/lib/visits/time";
import { loadVisitFormData } from "@/app/wizyty/form-data";
import { VisitForm } from "@/app/wizyty/visit-form";
import { AllergyNotice } from "../../../allergy-notice";
import { getClient } from "../../../data";

// Tytuł bez imienia klientki.
export const metadata: Metadata = { title: "Nowa wizyta – CreoCards" };

async function NewVisitContent({ params }: { params: PageProps<"/klientki/[id]/wizyta/nowa">["params"] }) {
  const { id } = await params;
  await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const { services, products, lastRecipe } = await loadVisitFormData(client.id);

  return (
    <>
      <Link href={`/klientki/${client.id}`} className="text-sm text-brand underline-offset-4 hover:underline">
        ← {client.full_name}
      </Link>
      <h1 className="text-2xl font-semibold">Nowa wizyta</h1>
      <AllergyNotice status={client.allergy_status} allergies={client.allergies} />
      <VisitForm
        clientId={client.id}
        services={services}
        products={products}
        lastRecipe={lastRecipe}
        initial={{ service_id: "", visit_at: toWarsawLocal(new Date()), price: "", recipe: { note: "", mixes: [] } }}
        cancelHref={`/klientki/${client.id}`}
      />
    </>
  );
}

export default function NewVisitPage({ params }: PageProps<"/klientki/[id]/wizyta/nowa">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <NewVisitContent params={params} />
      </Suspense>
    </main>
  );
}
