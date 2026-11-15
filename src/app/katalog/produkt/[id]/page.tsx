import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { EMPTY_PRODUCT_FORM } from "@/lib/catalog/form";
import {
  PRODUCT_TYPE_LABELS,
  effectiveRatio,
  formatNumber,
  formatRatio,
} from "@/lib/catalog/values";
import { getLines, getProduct, productLabel, type CatalogProduct } from "../../data";
import { ProductForm } from "../../product-form";
import { RequestForm } from "../../request-form";
import { DeleteProductButton } from "./delete-product-button";

export const metadata: Metadata = { title: "Produkt – CreoCards" };

const amount = (v: number | null) => (v === null ? "" : formatNumber(v));

function ProductDetails({ product }: { product: CatalogProduct }) {
  const ratio = effectiveRatio(product.ratio, product.line_ratio);
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-foreground/5 px-4 py-3 text-sm">
      <div>
        <dt className="text-foreground/60">Typ</dt>
        <dd className="font-medium">{PRODUCT_TYPE_LABELS[product.type]}</dd>
      </div>
      <div>
        <dt className="text-foreground/60">Pojemność</dt>
        <dd className="font-medium">{product.package_size !== null ? `${amount(product.package_size)} g/ml` : "—"}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-foreground/60">Proporcja utleniacza</dt>
        <dd className="font-medium">
          {ratio !== null ? formatRatio(ratio) : "brak"}
          {product.ratio !== null && product.line_ratio !== null && product.ratio !== product.line_ratio && (
            <span className="font-normal text-foreground/60"> (linia: {formatRatio(product.line_ratio)})</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

async function ProductContent({ params }: { params: PageProps<"/katalog/produkt/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const isOwner = user.role === "owner";
  const product = await getProduct(id, isOwner);
  if (!product) notFound();

  if (!isOwner) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{productLabel(product)}</h1>
        <ProductDetails product={product} />
        <RequestForm product={{ id: product.id, label: productLabel(product) }} />
      </>
    );
  }

  const lines = await getLines();
  return (
    <>
      <h1 className="text-2xl font-semibold">{productLabel(product)}</h1>
      <ProductForm
        id={product.id}
        lines={lines}
        initial={{
          ...EMPTY_PRODUCT_FORM,
          line_id: product.line_id,
          shade: product.shade,
          type: product.type,
          package_size: amount(product.package_size),
          purchase_price: amount(product.purchase_price),
          ratio: formatRatio(product.ratio),
        }}
        cancelHref="/katalog"
      />
      <DeleteProductButton id={product.id} />
    </>
  );
}

export default function ProductPage({ params }: PageProps<"/katalog/produkt/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link href="/katalog" className="text-sm text-brand underline-offset-4 hover:underline">
        ← Katalog
      </Link>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ProductContent params={params} />
      </Suspense>
    </main>
  );
}
