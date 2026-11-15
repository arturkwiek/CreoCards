import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Nowa klientka – CreoCards" };

async function NewClientContent() {
  await requireUser();
  return <ClientForm cancelHref="/klientki" />;
}

export default function NewClientPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold">Nowa klientka</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <NewClientContent />
      </Suspense>
    </main>
  );
}
