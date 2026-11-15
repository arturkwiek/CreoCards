import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/auth/session";
import { formatPhone, telHref } from "@/lib/clients/phone";
import { AllergyNotice } from "../allergy-notice";
import { getClient } from "../data";
import { VisitList } from "./visit-list";
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

      <AllergyNotice status={client.allergy_status} allergies={client.allergies} />

      <Link href={`/klientki/${client.id}/wizyta/nowa`} className={buttonStyles.primary}>
        + Nowa wizyta
      </Link>

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

      <Suspense fallback={<p className="text-sm text-foreground/60">Ładowanie wizyt…</p>}>
        <VisitList clientId={client.id} />
      </Suspense>

      <Link href={`/klientki/${client.id}/edytuj`} className={buttonStyles.secondary}>
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
