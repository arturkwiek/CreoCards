import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { ServicesImportForm } from "./services-import-form";

export const metadata: Metadata = { title: "Import usług – CreoCards" };

async function ImportContent() {
  await requireOwner();
  return <ServicesImportForm />;
}

export default function ServicesImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/uslugi" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Usługi
      </Link>
      <h1 className="text-2xl font-semibold">Import usług z CSV</h1>
      <p className="text-sm text-foreground/70">
        Eksport zakładki „Usługi” z arkusza: <b>Usługa</b>, Cena od (zł), Cena do (zł), Czas (min), Z farbą? (TRUE/FALSE).
        Kolumna „Uwagi” jest pomijana. Usługi, które już są na liście, zostaną zaktualizowane – puste pola niczego nie
        nadpisują. Przed zapisem zobaczysz podgląd.
      </p>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ImportContent />
      </Suspense>
    </main>
  );
}
