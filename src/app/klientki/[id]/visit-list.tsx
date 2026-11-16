import Link from "next/link";
import { getClientVisits, getProductLabels, getRecipes, getServiceNames, getTeamNames } from "@/app/wizyty/data";
import { getTimelinePhotos } from "@/app/zdjecia/data";
import { mixSummary } from "@/lib/visits/recipe";
import { formatVisitDate } from "@/lib/visits/time";

/** Oś czasu: wizyty klientki od najnowszej – data, usługa, kto wykonał, miniatury zdjęć i skrót receptury. */
export async function VisitList({ clientId }: { clientId: string }) {
  const visits = await getClientVisits(clientId);
  if (visits.length === 0) {
    return <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/70">Brak wizyt – zapisz pierwszą.</p>;
  }
  const [recipes, services, names, photos] = await Promise.all([
    getRecipes(visits.map((v) => v.id)),
    getServiceNames(),
    getTeamNames(),
    getTimelinePhotos(visits.map((v) => v.id)),
  ]);
  const labels = await getProductLabels(recipes.values());

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Wizyty</h2>
      <ul className="flex flex-col gap-2">
        {visits.map((v) => {
          const recipe = recipes.get(v.id);
          const visitPhotos = photos.get(v.id);
          return (
            <li key={v.id}>
              <Link href={`/wizyty/${v.id}`} className="flex flex-col gap-1 rounded-xl border border-foreground/10 px-4 py-3 active:bg-foreground/5">
                <span className="flex justify-between gap-2 text-sm">
                  <span className="font-semibold">{formatVisitDate(v.visit_at)}</span>
                  <span className="text-foreground/60">{names.get(v.created_by) ?? ""}</span>
                </span>
                <span className="font-medium">{(v.service_id && services.get(v.service_id)) || "Wizyta"}</span>
                {visitPhotos && (
                  <span className="flex gap-1.5">
                    {visitPhotos.thumbs.map((p) =>
                      p.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- podpisany link, bez optymalizacji Next
                        <img key={p.id} src={p.thumbUrl} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                      ) : null,
                    )}
                    {visitPhotos.total > visitPhotos.thumbs.length && (
                      <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-foreground/5 text-sm text-foreground/70">
                        +{visitPhotos.total - visitPhotos.thumbs.length}
                      </span>
                    )}
                  </span>
                )}
                {recipe?.mixes.map((m, i) => (
                  <span key={i} className="text-sm text-foreground/70">
                    {mixSummary(m, (pid) => labels.get(pid) ?? "?")}
                  </span>
                ))}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
