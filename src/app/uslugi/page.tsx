import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireOwner } from "@/lib/auth/session";
import { formatDuration, formatPriceRange } from "@/lib/services/import";
import { getServices } from "../wizyty/data";

export const metadata: Metadata = { title: "Usługi – CreoCards" };

async function ServicesContent() {
  await requireOwner();
  const services = await getServices();
  return (
    <>
      <Link href="/uslugi/import" className={buttonStyles.secondary}>
        Import CSV (zakładka „Usługi”)
      </Link>
      {services.length === 0 ? (
        <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-foreground/70">
          Lista usług jest pusta. Dodaj usługi albo zaimportuj je z arkusza.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 rounded-xl border border-foreground/10">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`/uslugi/${s.id}`} className="flex min-h-14 flex-col justify-center px-4 py-2.5 active:bg-foreground/5">
                <span className="font-medium">
                  {s.name}
                  {s.with_color && (
                    <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">z farbą</span>
                  )}
                </span>
                <span className="text-sm text-foreground/60">
                  {[formatPriceRange(s.price_from, s.price_to), formatDuration(s.duration_min)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-5 pt-6">
        <div className="mx-auto max-w-md">
          <Link href="/uslugi/nowa" className={buttonStyles.primary}>
            + Dodaj usługę
          </Link>
        </div>
      </div>
    </>
  );
}

export default function ServicesPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usługi</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ServicesContent />
      </Suspense>
    </main>
  );
}
