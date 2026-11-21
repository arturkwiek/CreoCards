import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { buildVersions } from "@/lib/audit/history";
import { isUuid } from "@/lib/catalog/form";
import { createClient } from "@/lib/supabase/server";
import { appointmentFields, getAuditEntries } from "@/app/historia/data";
import { VersionList } from "@/app/historia/version-list";
import { getServiceNames, getTeamNames } from "@/app/wizyty/data";

export const metadata: Metadata = { title: "Historia terminu – CreoCards" };

async function AppointmentHistory({ params }: { params: PageProps<"/grafik/[id]/historia">["params"] }) {
  const { id } = await params;
  await requireOwner();
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: appointment } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
  if (!appointment) notFound();

  const [entries, services, names] = await Promise.all([getAuditEntries("appointments", id), getServiceNames(), getTeamNames()]);
  const clientIds = [...new Set([appointment.client_id, ...entries.map((e) => e.old_row?.client_id).filter((v): v is string => typeof v === "string")])];
  const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
  const clientNames = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
  const versions = buildVersions(appointmentFields(services, names, clientNames), entries, appointment);
  const path = `/grafik/${id}/historia`;

  return (
    <>
      <Link href={`/grafik/${id}`} className="text-sm text-brand underline-offset-4 hover:underline">
        ← Termin
      </Link>
      <h1 className="text-2xl font-semibold">Historia terminu</h1>
      <p className="text-sm text-foreground/60">
        Widoczna tylko dla właścicielki. Przywrócenie wersji zapisuje obecny stan w historii, więc zawsze można je cofnąć.
      </p>
      <VersionList versions={versions} names={names} path={path} restorable={!appointment.deleted_at} />
    </>
  );
}

export default function AppointmentHistoryPage({ params }: PageProps<"/grafik/[id]/historia">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <AppointmentHistory params={params} />
      </Suspense>
    </main>
  );
}
