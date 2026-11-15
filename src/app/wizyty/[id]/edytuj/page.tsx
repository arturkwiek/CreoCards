import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { formatNumber } from "@/lib/catalog/values";
import { toWarsawLocal } from "@/lib/visits/time";
import { AllergyNotice } from "@/app/klientki/allergy-notice";
import { getClient } from "@/app/klientki/data";
import { getRecipes, getVisit } from "../../data";
import { loadVisitFormData } from "../../form-data";
import { VisitForm } from "../../visit-form";

export const metadata: Metadata = { title: "Edycja wizyty – CreoCards" };

async function EditVisitContent({ params }: { params: PageProps<"/wizyty/[id]/edytuj">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const visit = await getVisit(id);
  if (!visit) notFound();
  // Edytuje autorka wizyty lub właścicielka (to samo sprawdza RLS).
  if (visit.created_by !== user.id && user.role !== "owner") redirect(`/wizyty/${visit.id}`);
  const client = await getClient(visit.client_id);
  if (!client) notFound();

  const [recipes, { services, products, lastRecipe }] = await Promise.all([
    getRecipes([visit.id]),
    loadVisitFormData(client.id, visit.id),
  ]);

  return (
    <>
      <Link href={`/wizyty/${visit.id}`} className="text-sm text-brand underline-offset-4 hover:underline">
        ← Wizyta
      </Link>
      <h1 className="text-2xl font-semibold">Edycja wizyty – {client.full_name}</h1>
      <AllergyNotice status={client.allergy_status} allergies={client.allergies} />
      <VisitForm
        clientId={client.id}
        visitId={visit.id}
        services={services}
        products={products}
        lastRecipe={lastRecipe}
        initial={{
          service_id: visit.service_id ?? "",
          visit_at: toWarsawLocal(visit.visit_at),
          price: visit.price !== null ? formatNumber(visit.price) : "",
          recipe: recipes.get(visit.id) ?? { note: "", mixes: [] },
        }}
        cancelHref={`/wizyty/${visit.id}`}
      />
    </>
  );
}

export default function EditVisitPage({ params }: PageProps<"/wizyty/[id]/edytuj">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <EditVisitContent params={params} />
      </Suspense>
    </main>
  );
}
