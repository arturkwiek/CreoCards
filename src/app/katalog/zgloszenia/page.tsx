import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/ui";
import { visibleEmail } from "@/lib/auth/login";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveRequest } from "../actions";
import { getProducts, productLabel } from "../data";

export const metadata: Metadata = { title: "Zgłoszenia – CreoCards" };

const dateFormat = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const KIND_LABELS = { missing: "Brak w katalogu", running_low: "Kończy się" } as const;

async function RequestsContent() {
  await requireOwner();
  const supabase = await createClient();
  const [{ data: requests }, { data: team }, products] = await Promise.all([
    supabase
      .from("product_requests")
      .select("id, kind, product_id, description, created_by, created_at, resolved_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("users").select("id, full_name, email, login"),
    getProducts(false),
  ]);

  const names = new Map((team ?? []).map((u) => [u.id, u.full_name || u.login || visibleEmail(u.email)]));
  const productNames = new Map(products.map((p) => [p.id, productLabel(p)]));
  const open = (requests ?? []).filter((r) => r.resolved_at === null);
  const resolved = (requests ?? []).filter((r) => r.resolved_at !== null).slice(0, 10);

  const item = (r: NonNullable<typeof requests>[number]) => (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">{KIND_LABELS[r.kind]}</p>
      {r.product_id && (
        <p className="font-medium">{productNames.get(r.product_id) ?? "Produkt usunięty z katalogu"}</p>
      )}
      {r.description && <p className="whitespace-pre-wrap">{r.description}</p>}
      <p className="text-sm text-foreground/60">
        {names.get(r.created_by) ?? "—"} · {dateFormat.format(new Date(r.created_at))}
      </p>
    </>
  );

  return (
    <>
      {open.length === 0 ? (
        <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-foreground/70">Brak otwartych zgłoszeń.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {open.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 rounded-xl border border-foreground/15 p-4">
              {item(r)}
              <form action={resolveRequest} className="mt-2">
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton variant="secondary" pendingText="Zapisywanie…">
                  Załatwione
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <details className="rounded-xl border border-foreground/10 p-4">
          <summary className="cursor-pointer text-sm font-medium">Ostatnio załatwione</summary>
          <ul className="mt-3 flex flex-col gap-3 text-foreground/70">
            {resolved.map((r) => (
              <li key={r.id} className="flex flex-col gap-1">
                {item(r)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export default function RequestsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/katalog" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Katalog
      </Link>
      <h1 className="text-2xl font-semibold">Zgłoszenia braków</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <RequestsContent />
      </Suspense>
    </main>
  );
}
