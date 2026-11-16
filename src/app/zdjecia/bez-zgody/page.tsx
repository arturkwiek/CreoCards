import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { formatVisitDate } from "@/lib/visits/time";
import { getTeamNames } from "@/app/wizyty/data";
import { getPhotosWithoutConsent } from "../data";
import { ConsentActions } from "./consent-actions";

export const metadata: Metadata = { title: "Zdjęcia bez zgody – CreoCards" };

async function List() {
  await requireOwner();
  const [photos, names] = await Promise.all([getPhotosWithoutConsent(), getTeamNames()]);
  if (photos.length === 0) {
    return <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-foreground/70">Wszystkie zdjęcia z twarzą mają zgodę klientek.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {photos.map((p) => (
        <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-amber-500/40 p-4">
          <div className="flex gap-3">
            {p.thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- podpisany link, bez optymalizacji Next
              <img src={p.thumbUrl} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <Link href={`/klientki/${p.clientId}`} className="font-medium text-brand underline-offset-4 hover:underline">
                {p.clientName}
              </Link>
              <Link href={`/wizyty/${p.visitId}`} className="text-foreground/70 underline-offset-4 hover:underline">
                Wizyta – zdjęcie z {formatVisitDate(p.createdAt)}
              </Link>
              <span className="text-foreground/60">{names.get(p.createdBy) ?? ""}</span>
            </div>
          </div>
          <ConsentActions photoId={p.id} clientId={p.clientId} />
        </li>
      ))}
    </ul>
  );
}

export default function PhotosWithoutConsentPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Zdjęcia bez zgody</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>
      <p className="text-sm text-foreground/60">
        Zdjęcia z twarzą klientek, które nie mają zgody na wizerunek. Dopisz zgodę (z dzisiejszą datą) albo przenieś zdjęcie do kosza.
      </p>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <List />
      </Suspense>
    </main>
  );
}
