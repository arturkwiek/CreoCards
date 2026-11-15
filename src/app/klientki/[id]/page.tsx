import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/auth/session";
import { formatPhone, telHref } from "@/lib/clients/phone";
import { getClient } from "../data";
import { DeleteClientButton } from "./delete-client-button";

// Tytuł bez imienia klientki (dane osobowe nie trafiają do historii przeglądarki).
export const metadata: Metadata = { title: "Klientka – CreoCards" };

const dateFormat = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" });

async function ClientDetail({ params }: { params: PageProps<"/klientki/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <>
      <h1 className="text-2xl font-semibold">{client.full_name}</h1>

      {client.allergy_status === "has" ? (
        <section
          aria-label="Alergie i uwagi zdrowotne"
          className="rounded-xl border-2 border-red-600 bg-red-50 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100"
        >
          <p className="font-semibold">⚠ Alergie / uwagi zdrowotne</p>
          <p className="mt-1 whitespace-pre-wrap">
            {client.allergies || "Brak opisu – dopytaj klientkę przed koloryzacją."}
          </p>
        </section>
      ) : (
        <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/70">Brak znanych alergii</p>
      )}

      <a href={telHref(client.phone)} className={buttonStyles.secondary}>
        Zadzwoń: {formatPhone(client.phone)}
      </a>

      <dl className="flex flex-col gap-3 text-sm">
        {client.email && (
          <div>
            <dt className="text-foreground/60">E-mail</dt>
            <dd>{client.email}</dd>
          </div>
        )}
        {client.note && (
          <div>
            <dt className="text-foreground/60">Notatka</dt>
            <dd className="whitespace-pre-wrap">{client.note}</dd>
          </div>
        )}
        <div>
          <dt className="text-foreground/60">Zgody</dt>
          <dd>
            RODO: {client.rodo_consent_at ? `tak (${dateFormat.format(new Date(client.rodo_consent_at))})` : "nie"}
            {" · "}
            Powiadomienia:{" "}
            {client.notifications_consent_at
              ? `tak (${dateFormat.format(new Date(client.notifications_consent_at))})`
              : "nie"}
          </dd>
        </div>
      </dl>

      <p className="rounded-xl border border-dashed border-foreground/20 px-4 py-3 text-sm text-foreground/60">
        Wizyty i receptury pojawią się tu w kolejnym etapie.
      </p>

      <Link href={`/klientki/${client.id}/edytuj`} className={buttonStyles.primary}>
        Edytuj dane
      </Link>
      {user.role === "owner" && <DeleteClientButton id={client.id} />}
    </>
  );
}

export default function ClientPage({ params }: PageProps<"/klientki/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/klientki" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Klientki
      </Link>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ClientDetail params={params} />
      </Suspense>
    </main>
  );
}
