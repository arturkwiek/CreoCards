import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { buildVersions, type AuditEntry } from "@/lib/audit/history";
import { createClient } from "@/lib/supabase/server";
import { mixSummary, type DraftRecipe } from "@/lib/visits/recipe";
import { getAuditEntries, visitFields } from "@/app/historia/data";
import { VersionList } from "@/app/historia/version-list";
import { getProductLabels, getRecipes, getServiceNames, getTeamNames } from "../../data";

export const metadata: Metadata = { title: "Historia wizyty – CreoCards" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asRecipe(value: unknown): DraftRecipe {
  const r = (value ?? {}) as Partial<DraftRecipe>;
  return { note: typeof r.note === "string" ? r.note : "", mixes: Array.isArray(r.mixes) ? r.mixes : [] };
}

async function VisitHistory({ params }: { params: PageProps<"/wizyty/[id]/historia">["params"] }) {
  const { id } = await params;
  await requireOwner();
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", id).maybeSingle();
  if (!visit) notFound();

  const [visitEntries, recipeEntries, recipes, services, names] = await Promise.all([
    getAuditEntries("visits", id),
    getAuditEntries("visit_recipe", id),
    getRecipes([id]),
    getServiceNames(),
    getTeamNames(),
  ]);
  const current = recipes.get(id) ?? { note: "", mixes: [] };
  const snapshots = recipeEntries.map((e) => asRecipe(e.old_row));
  const labels = await getProductLabels([current, ...snapshots]);
  const summary = (r: DraftRecipe) =>
    [...r.mixes.map((m) => mixSummary(m, (pid) => labels.get(pid) ?? "?")), r.note ? `Notatka: ${r.note}` : ""]
      .filter(Boolean)
      .join("\n") || "brak receptury";

  // Receptura jako jedno pole „Receptura” – porównanie całych wersji.
  const recipeField = [{ key: "summary", label: "Receptura" }];
  const recipeVersions = buildVersions(
    recipeField,
    recipeEntries.map((e): AuditEntry => ({ ...e, old_row: { summary: summary(asRecipe(e.old_row)) } })),
    { summary: summary(current) },
  );
  const visitVersions = buildVersions(visitFields(services), visitEntries, visit);
  const path = `/wizyty/${id}/historia`;

  return (
    <>
      <Link href={`/wizyty/${id}`} className="text-sm text-brand underline-offset-4 hover:underline">
        ← Wizyta
      </Link>
      <h1 className="text-2xl font-semibold">Historia wizyty</h1>
      <p className="text-sm text-foreground/60">
        Widoczna tylko dla właścicielki. Przywrócenie wersji zapisuje obecny stan w historii, więc zawsze można je cofnąć.
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Receptura</h2>
        <VersionList versions={recipeVersions} names={names} path={path} restorable={!visit.deleted_at} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Dane wizyty</h2>
        <VersionList versions={visitVersions} names={names} path={path} restorable={!visit.deleted_at} />
      </section>
    </>
  );
}

export default function VisitHistoryPage({ params }: PageProps<"/wizyty/[id]/historia">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <VisitHistory params={params} />
      </Suspense>
    </main>
  );
}
