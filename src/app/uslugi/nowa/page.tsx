import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Nowa usługa – CreoCards" };

async function NewServiceContent() {
  await requireOwner();
  return <ServiceForm />;
}

export default function NewServicePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold">Nowa usługa</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <NewServiceContent />
      </Suspense>
    </main>
  );
}
