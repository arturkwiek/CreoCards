import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/auth/session";
import { CatalogList } from "./catalog-list";
import { countOpenRequests, getProducts } from "./data";

export const metadata: Metadata = { title: "Katalog – CreoCards" };

async function CatalogContent() {
  const user = await requireUser();
  const isOwner = user.role === "owner";
  const [products, openRequests] = await Promise.all([
    getProducts(isOwner),
    isOwner ? countOpenRequests() : Promise.resolve(0),
  ]);

  return (
    <>
      {isOwner && (
        <div className="grid grid-cols-2 gap-2">
          <Link href="/katalog/import" className={buttonStyles.secondary}>
            Import CSV
          </Link>
          <Link href="/katalog/zgloszenia" className={buttonStyles.secondary}>
            Zgłoszenia{openRequests > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{openRequests}</span>}
          </Link>
        </div>
      )}

      <CatalogList products={products} isOwner={isOwner} />

      {/* Pod kciukiem: główna akcja przyklejona do dołu ekranu. */}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-5 pt-6">
        <div className="mx-auto max-w-md">
          {isOwner ? (
            <Link href="/katalog/nowy" className={buttonStyles.primary}>
              + Dodaj produkt
            </Link>
          ) : (
            <Link href="/katalog/zglos" className={buttonStyles.primary}>
              Nie ma na liście? Zgłoś brak
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

export default function CatalogPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalog</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <CatalogContent />
      </Suspense>
    </main>
  );
}
