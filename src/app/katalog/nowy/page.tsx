import type { Metadata } from "next";
import { Suspense } from "react";
import { FormMessage } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { EMPTY_PRODUCT_FORM } from "@/lib/catalog/form";
import { getLine, getLines, getProduct, productLabel } from "../data";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Nowy produkt – CreoCards" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function NewProductContent({ searchParams }: { searchParams: PageProps<"/katalog/nowy">["searchParams"] }) {
  await requireOwner();
  const params = await searchParams;
  const [lines, line, added] = await Promise.all([
    getLines(),
    getLine(one(params.linia)),
    getProduct(one(params.dodano), true),
  ]);

  return (
    <>
      {added && <FormMessage success={`Dodano: ${productLabel(added)}. Możesz dodać kolejny odcień.`} />}
      {/* key: po dodaniu formularz startuje od nowa, z tą samą linią. */}
      <ProductForm
        key={added?.id ?? "new"}
        lines={lines}
        initial={{
          ...EMPTY_PRODUCT_FORM,
          line_id: line?.id ?? "",
          type: added?.type ?? EMPTY_PRODUCT_FORM.type,
          package_size: added?.package_size != null ? String(added.package_size).replace(".", ",") : "",
        }}
        cancelHref="/katalog"
      />
    </>
  );
}

export default function NewProductPage({ searchParams }: PageProps<"/katalog/nowy">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold">Nowy produkt</h1>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <NewProductContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
