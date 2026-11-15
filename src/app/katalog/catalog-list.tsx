"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterProducts } from "@/lib/catalog/search";
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  effectiveRatio,
  formatNumber,
  formatPrice,
  formatRatio,
  type ProductType,
} from "@/lib/catalog/values";
import type { CatalogProduct } from "./data";

const chip = "min-h-10 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium";

const groupName = (p: CatalogProduct) => (p.line ? `${p.brand} · ${p.line}` : p.brand);

function details(p: CatalogProduct, showPrice: boolean): string {
  const ratio = effectiveRatio(p.ratio, p.line_ratio);
  return [
    PRODUCT_TYPE_LABELS[p.type],
    p.package_size !== null ? `${formatNumber(p.package_size)} g/ml` : null,
    ratio !== null ? formatRatio(ratio) : null,
    showPrice && p.purchase_price !== null ? formatPrice(p.purchase_price) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Katalog z wyszukiwarką (w przeglądarce): „7.1” pokazuje pasujące odcienie, słowa – markę i linię.
 * Bez frazy – grupy marka/linia; z frazą – najlepsze dopasowania na górze.
 */
export function CatalogList({ products, isOwner }: { products: CatalogProduct[]; isOwner: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ProductType | null>(null);
  const results = useMemo(() => filterProducts(products, query, type), [products, query, type]);
  const searching = query.trim() !== "";
  const presentTypes = PRODUCT_TYPES.filter((t) => products.some((p) => p.type === t));

  if (products.length === 0) {
    return (
      <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-foreground/70">
        Katalog jest pusty. Właścicielka dodaje produkty albo importuje je z pliku CSV.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="catalog-search" className="sr-only">
        Szukaj w katalogu
      </label>
      <input
        id="catalog-search"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        inputMode="search"
        placeholder="Odcień (np. 7.1), marka lub linia"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 rounded-xl border border-foreground/20 bg-background px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />

      {presentTypes.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Typ">
          <button
            type="button"
            aria-pressed={type === null}
            onClick={() => setType(null)}
            className={`${chip} ${type === null ? "border-brand bg-brand text-white" : "border-foreground/20"}`}
          >
            Wszystkie
          </button>
          {presentTypes.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(type === t ? null : t)}
              className={`${chip} ${type === t ? "border-brand bg-brand text-white" : "border-foreground/20"}`}
            >
              {PRODUCT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <p className="px-1 py-4 text-center text-foreground/60">Brak produktów pasujących do wyszukiwania.</p>
      ) : (
        <ul className="flex flex-col">
          {results.map((p, i) => {
            const group = groupName(p);
            const header = !searching && (i === 0 || groupName(results[i - 1]) !== group);
            return (
              <li key={p.id}>
                {header && (
                  <div className="flex items-center justify-between px-1 pb-1 pt-4 text-sm font-semibold text-foreground/70">
                    <span>{group}</span>
                    {isOwner && (
                      <Link href={`/katalog/linia/${p.line_id}`} className="font-normal text-brand">
                        Edytuj linię
                      </Link>
                    )}
                  </div>
                )}
                <Link
                  href={`/katalog/produkt/${p.id}`}
                  className="flex min-h-14 items-center gap-3 border-b border-foreground/10 px-1 py-2.5 active:bg-foreground/5"
                >
                  <span className="min-w-16 text-lg font-semibold tabular-nums">{p.shade}</span>
                  <span className="min-w-0 flex-1">
                    {searching && <span className="block truncate text-sm font-medium">{group}</span>}
                    <span className="block truncate text-sm text-foreground/60">{details(p, isOwner)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
