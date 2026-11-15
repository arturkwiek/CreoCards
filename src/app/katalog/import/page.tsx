import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import katalogu – CreoCards" };

async function ImportContent() {
  await requireOwner();
  return <ImportForm />;
}

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/katalog" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Katalog
      </Link>
      <h1 className="text-2xl font-semibold">Import katalogu z CSV</h1>
      <div className="flex flex-col gap-2 text-sm text-foreground/70">
        <p>
          Kolumny w dowolnej kolejności: <b>Marka</b>, Linia, <b>Odcień / stężenie</b>, <b>Typ</b> (farba, utleniacz,
          rozjaśniacz, toner, inny), Domyślna proporcja (np. 1:1,5), Pojemność opakowania (g/ml), Cena zakupu (zł).
          Kolumna „Uwagi” jest pomijana. Separator przecinek lub średnik.
        </p>
        <p>
          Produkty, które już są w katalogu, zostaną zaktualizowane – puste pola w pliku niczego nie nadpisują. Przed
          zapisem zobaczysz podgląd zmian.
        </p>
      </div>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ImportContent />
      </Suspense>
    </main>
  );
}
