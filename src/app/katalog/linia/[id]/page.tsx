import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { formatRatio } from "@/lib/catalog/values";
import { getLine } from "../../data";
import { LineForm } from "./line-form";

export const metadata: Metadata = { title: "Linia – CreoCards" };

async function LineContent({ params }: { params: PageProps<"/katalog/linia/[id]">["params"] }) {
  const { id } = await params;
  await requireOwner();
  const line = await getLine(id);
  if (!line) notFound();
  return (
    <LineForm
      id={line.id}
      initial={{ brand: line.brand, name: line.name, default_ratio: formatRatio(line.default_ratio) }}
    />
  );
}

export default function LinePage({ params }: PageProps<"/katalog/linia/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/katalog" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Katalog
      </Link>
      <h1 className="text-2xl font-semibold">Marka i linia</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <LineContent params={params} />
      </Suspense>
    </main>
  );
}
