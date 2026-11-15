import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/catalog/values";
import { mixSummary } from "@/lib/visits/recipe";
import { formatVisitDate } from "@/lib/visits/time";
import { AllergyNotice } from "@/app/klientki/allergy-notice";
import { getClient } from "@/app/klientki/data";
import { getProductLabels, getRecipes, getServiceNames, getTeamNames, getVisit } from "../data";
import { DeleteVisitButton } from "./delete-visit-button";

export const metadata: Metadata = { title: "Wizyta – CreoCards" };

async function VisitContent({ params }: { params: PageProps<"/wizyty/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const visit = await getVisit(id);
  if (!visit) notFound();
  const [client, recipes, services, names] = await Promise.all([
    getClient(visit.client_id),
    getRecipes([visit.id]),
    getServiceNames(),
    getTeamNames(),
  ]);
  if (!client) notFound();
  const recipe = recipes.get(visit.id);
  const labels = await getProductLabels(recipe ? [recipe] : []);
  const serviceName = visit.service_id ? services.get(visit.service_id) : undefined;
  const canEdit = visit.created_by === user.id || user.role === "owner";

  return (
    <>
      <Link href={`/klientki/${client.id}`} className="text-sm text-brand underline-offset-4 hover:underline">
        ← {client.full_name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{serviceName ?? "Wizyta"}</h1>
        <p className="text-sm text-foreground/60">
          {formatVisitDate(visit.visit_at, true)} · {names.get(visit.created_by) ?? "—"}
          {visit.price !== null && ` · ${formatPrice(visit.price)}`}
        </p>
      </div>
      <AllergyNotice status={client.allergy_status} allergies={client.allergies} />

      {recipe && recipe.mixes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Receptura</h2>
          <ul className="flex flex-col gap-2">
            {recipe.mixes.map((m, i) => (
              <li key={i} className="rounded-xl bg-foreground/5 px-4 py-3 text-sm">
                {mixSummary(m, (pid) => labels.get(pid) ?? "?")}
              </li>
            ))}
          </ul>
          {recipe.note && <p className="whitespace-pre-wrap text-sm">{recipe.note}</p>}
        </section>
      ) : (
        <p className="text-sm text-foreground/60">Wizyta bez receptury.</p>
      )}

      {canEdit && (
        <Link href={`/wizyty/${visit.id}/edytuj`} className={buttonStyles.primary}>
          Edytuj wizytę
        </Link>
      )}
      {user.role === "owner" && (
        <>
          <Link href={`/wizyty/${visit.id}/historia`} className={buttonStyles.secondary}>
            Historia zmian
          </Link>
          <DeleteVisitButton id={visit.id} />
        </>
      )}
    </>
  );
}

export default function VisitPage({ params }: PageProps<"/wizyty/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <VisitContent params={params} />
      </Suspense>
    </main>
  );
}
