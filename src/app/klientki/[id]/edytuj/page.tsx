import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { ClientForm } from "../../client-form";
import { getClient, toFormValues } from "../../data";

export const metadata: Metadata = { title: "Edycja klientki – CreoCards" };

async function EditClientContent({ params }: { params: PageProps<"/klientki/[id]/edytuj">["params"] }) {
  const { id } = await params;
  await requireUser();
  const client = await getClient(id);
  if (!client) notFound();

  return <ClientForm id={client.id} initial={toFormValues(client)} cancelHref={`/klientki/${client.id}`} />;
}

export default function EditClientPage({ params }: PageProps<"/klientki/[id]/edytuj">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold">Edycja klientki</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <EditClientContent params={params} />
      </Suspense>
    </main>
  );
}
