import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { RequestForm } from "../request-form";

export const metadata: Metadata = { title: "Zgłoś brak – CreoCards" };

async function RequestContent() {
  await requireUser();
  return <RequestForm />;
}

export default function RequestPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/katalog" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Katalog
      </Link>
      <h1 className="text-2xl font-semibold">Zgłoś brak</h1>
      <p className="text-sm text-foreground/70">
        Nie ma farby lub preparatu na liście? Opisz, czego brakuje – właścicielka doda to do katalogu. Jeśli
        produkt jest w katalogu, ale się kończy, otwórz go i wybierz „Zgłoś: kończy się”.
      </p>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <RequestContent />
      </Suspense>
    </main>
  );
}
