import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { buildVersions } from "@/lib/audit/history";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_FIELDS, getAuditEntries } from "@/app/historia/data";
import { VersionList } from "@/app/historia/version-list";
import { getTeamNames } from "@/app/wizyty/data";

// Tytuł bez imienia klientki.
export const metadata: Metadata = { title: "Historia zmian – CreoCards" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ClientHistory({ params }: { params: PageProps<"/klientki/[id]/historia">["params"] }) {
  const { id } = await params;
  await requireOwner();
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();
  const [entries, names] = await Promise.all([getAuditEntries("clients", id), getTeamNames()]);
  const versions = buildVersions(CLIENT_FIELDS, entries, client);

  return (
    <>
      <Link href={`/klientki/${id}`} className="text-sm text-brand underline-offset-4 hover:underline">
        ← {client.full_name}
      </Link>
      <h1 className="text-2xl font-semibold">Historia zmian</h1>
      <p className="text-sm text-foreground/60">
        Widoczna tylko dla właścicielki. Przywrócenie wersji zapisuje obecny stan w historii, więc zawsze można je cofnąć.
      </p>
      {client.deleted_at && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Klientka jest w koszu – najpierw przywróć ją z <Link href="/kosz" className="underline">kosza</Link>.
        </p>
      )}
      <VersionList versions={versions} names={names} path={`/klientki/${id}/historia`} restorable={!client.deleted_at} />
    </>
  );
}

export default function ClientHistoryPage({ params }: PageProps<"/klientki/[id]/historia">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ClientHistory params={params} />
      </Suspense>
    </main>
  );
}
