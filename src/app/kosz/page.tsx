import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { formatPhone } from "@/lib/clients/phone";
import { createClient } from "@/lib/supabase/server";
import { formatVisitDate } from "@/lib/visits/time";
import type { TrashKind } from "../historia/actions";
import { RestoreFromTrashButton } from "../historia/restore-button";
import { signThumbs } from "../zdjecia/data";
import { getServiceNames, getTeamNames } from "../wizyty/data";

export const metadata: Metadata = { title: "Kosz – CreoCards" };

const TABS = [
  { key: "klientki", label: "Klientki" },
  { key: "wizyty", label: "Wizyty" },
  { key: "produkty", label: "Produkty" },
  { key: "zdjecia", label: "Zdjęcia" },
  { key: "terminy", label: "Terminy" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** Kto usunął – ostatni wpis „delete” w historii (dla wierszy z audytem). */
async function deletedBy(table: "clients" | "visits" | "products" | "attachments" | "appointments", ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("row_id, created_by, created_at")
    .eq("table_name", table)
    .eq("action", "delete")
    .in("row_id", ids)
    .order("created_at", { ascending: true });
  return new Map((data ?? []).filter((e) => e.row_id && e.created_by).map((e) => [e.row_id as string, e.created_by as string]));
}

type Item = { id: string; title: string; detail: string; deletedAt: string; by?: string; thumbUrl?: string | null };

async function TrashContent({ searchParams }: { searchParams: PageProps<"/kosz">["searchParams"] }) {
  await requireOwner();
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.typ) ? (params.typ as Tab) : "klientki";
  const supabase = await createClient();
  const names = await getTeamNames();
  let items: Item[] = [];
  let kind: TrashKind = "client";

  if (tab === "klientki") {
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, phone, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);
    const by = await deletedBy("clients", (data ?? []).map((c) => c.id));
    items = (data ?? []).map((c) => ({ id: c.id, title: c.full_name, detail: formatPhone(c.phone), deletedAt: c.deleted_at!, by: by.get(c.id) }));
  } else if (tab === "wizyty") {
    kind = "visit";
    const { data } = await supabase
      .from("visits")
      .select("id, client_id, service_id, visit_at, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);
    const clientIds = [...new Set((data ?? []).map((v) => v.client_id))];
    const [{ data: clients }, services, by] = await Promise.all([
      supabase.from("clients").select("id, full_name").in("id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]),
      getServiceNames(),
      deletedBy("visits", (data ?? []).map((v) => v.id)),
    ]);
    const clientNames = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
    items = (data ?? []).map((v) => ({
      id: v.id,
      title: `${clientNames.get(v.client_id) ?? "Klientka"} – ${(v.service_id && services.get(v.service_id)) || "wizyta"}`,
      detail: formatVisitDate(v.visit_at),
      deletedAt: v.deleted_at!,
      by: by.get(v.id),
    }));
  } else if (tab === "terminy") {
    kind = "appointment";
    const { data } = await supabase
      .from("appointments")
      .select("id, staff_id, service_id, starts_at, deleted_at, clients(full_name)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);
    const rows = data ?? [];
    const [services, by] = await Promise.all([getServiceNames(), deletedBy("appointments", rows.map((r) => r.id))]);
    items = rows.map((r) => ({
      id: r.id,
      title: `${r.clients?.full_name ?? "Klientka"} – ${(r.service_id && services.get(r.service_id)) || "termin"}`,
      detail: `${formatVisitDate(r.starts_at, true)} · ${names.get(r.staff_id) ?? ""}`,
      deletedAt: r.deleted_at!,
      by: by.get(r.id),
    }));
  } else if (tab === "zdjecia") {
    kind = "photo";
    const { data } = await supabase
      .from("attachments")
      .select("id, client_id, visit_id, thumb_path, deleted_at, clients(full_name), visits(visit_at)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);
    const rows = data ?? [];
    const [urls, by] = await Promise.all([
      signThumbs(rows.map((r) => r.thumb_path)),
      deletedBy("attachments", rows.map((r) => r.id)),
    ]);
    items = rows.map((r) => ({
      id: r.id,
      title: r.clients?.full_name ?? "Klientka",
      detail: r.visits ? `Wizyta ${formatVisitDate(r.visits.visit_at)}` : "",
      deletedAt: r.deleted_at!,
      by: by.get(r.id),
      thumbUrl: urls.get(r.thumb_path) ?? null,
    }));
  } else {
    kind = "product";
    const { data } = await supabase
      .from("products")
      .select("id, shade, line_id, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);
    const lineIds = [...new Set((data ?? []).map((p) => p.line_id))];
    const [{ data: lines }, by] = await Promise.all([
      supabase.from("product_lines").select("id, brand, name").in("id", lineIds.length ? lineIds : ["00000000-0000-0000-0000-000000000000"]),
      deletedBy("products", (data ?? []).map((p) => p.id)),
    ]);
    const lineNames = new Map((lines ?? []).map((l) => [l.id, [l.brand, l.name].filter(Boolean).join(" ")]));
    items = (data ?? []).map((p) => ({ id: p.id, title: p.shade, detail: lineNames.get(p.line_id) ?? "", deletedAt: p.deleted_at!, by: by.get(p.id) }));
  }

  return (
    <>
      <nav className="flex flex-wrap gap-2" aria-label="Rodzaj">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/kosz?typ=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              tab === t.key ? "border-brand bg-brand text-white" : "border-foreground/20"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-foreground/70">Kosz jest pusty.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4">
              {item.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- podpisany link, bez optymalizacji Next
                <img src={item.thumbUrl} alt="" loading="lazy" className="h-24 w-24 rounded-lg object-cover" />
              )}
              <div>
                <p className="font-medium">{item.title}</p>
                {item.detail && <p className="text-sm text-foreground/60">{item.detail}</p>}
                <p className="text-sm text-foreground/60">
                  Usunięto {formatVisitDate(item.deletedAt, true)}
                  {item.by ? ` · ${names.get(item.by) ?? ""}` : ""}
                </p>
              </div>
              <RestoreFromTrashButton kind={kind} id={item.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function TrashPage({ searchParams }: PageProps<"/kosz">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kosz</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>
      <p className="text-sm text-foreground/60">
        Usunięte klientki, wizyty, produkty, zdjęcia i terminy – dane zostają w bazie i można je przywrócić. Widoczne tylko dla właścicielki.
      </p>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <TrashContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
