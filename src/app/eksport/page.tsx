import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireOwner } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Eksport danych – CreoCards" };

async function ExportContent() {
  await requireOwner();
  return (
    <>
      <a href="/eksport/wszystko?format=xlsx" download className={buttonStyles.primary}>
        Pobierz wszystko (XLSX)
      </a>
      <a href="/eksport/wszystko?format=csv" download className={buttonStyles.secondary}>
        Pobierz wszystko (ZIP z plikami CSV)
      </a>
      <p className="text-sm text-foreground/60">
        Dane jednej klientki (np. na jej prośbę – RODO) pobierzesz z jej karty: „Eksportuj dane klientki”.
      </p>
    </>
  );
}

export default function ExportPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Eksport danych</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>
      <p className="text-sm text-foreground/70">
        Plik zawiera wszystkie dane salonu, także dane wrażliwe (alergie). Przechowuj go bezpiecznie i nie wysyłaj
        mailem bez szyfrowania. Każdy eksport zapisuje się w historii.
      </p>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ExportContent />
      </Suspense>
    </main>
  );
}
