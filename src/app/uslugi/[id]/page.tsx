import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { formatNumber } from "@/lib/catalog/values";
import { getService } from "../../wizyty/data";
import { ServiceForm } from "../service-form";
import { DeleteServiceButton } from "./delete-service-button";

export const metadata: Metadata = { title: "Usługa – CreoCards" };

const amount = (v: number | null) => (v === null ? "" : formatNumber(v));

async function ServiceContent({ params }: { params: PageProps<"/uslugi/[id]">["params"] }) {
  const { id } = await params;
  await requireOwner();
  const service = await getService(id);
  if (!service) notFound();
  return (
    <>
      <h1 className="text-2xl font-semibold">{service.name}</h1>
      <ServiceForm
        id={service.id}
        initial={{
          name: service.name,
          price_from: amount(service.price_from),
          price_to: amount(service.price_to),
          duration_min: service.duration_min !== null ? String(service.duration_min) : "",
          with_color: service.with_color,
        }}
      />
      <DeleteServiceButton id={service.id} />
    </>
  );
}

export default function ServicePage({ params }: PageProps<"/uslugi/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/uslugi" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Usługi
      </Link>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ServiceContent params={params} />
      </Suspense>
    </main>
  );
}
