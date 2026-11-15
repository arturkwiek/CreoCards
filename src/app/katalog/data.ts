import "server-only";
import { cache } from "react";
import { isUuid } from "@/lib/catalog/form";
import type { ProductType } from "@/lib/catalog/values";
import { createClient } from "@/lib/supabase/server";

export type CatalogLine = { id: string; brand: string; name: string; default_ratio: number | null };

export type CatalogProduct = {
  id: string;
  line_id: string;
  brand: string;
  line: string;
  shade: string;
  type: ProductType;
  package_size: number | null;
  ratio: number | null;
  line_ratio: number | null;
  /** Tylko dla właścicielki (dla uczennicy zawsze null – kolumna nie jest pobierana). */
  purchase_price: number | null;
};

export const getLines = cache(async (): Promise<CatalogLine[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_lines")
    .select("id, brand, name, default_ratio")
    .is("deleted_at", null)
    .order("brand")
    .order("name");
  return data ?? [];
});

/** Aktywne produkty salonu z danymi linii. Cenę zakupu pobieramy tylko dla właścicielki. */
export const getProducts = cache(async (withPrice: boolean): Promise<CatalogProduct[]> => {
  const supabase = await createClient();
  const [lines, { data }] = await Promise.all([
    getLines(),
    withPrice
      ? supabase
          .from("products")
          .select("id, line_id, shade, type, package_size, ratio, purchase_price")
          .is("deleted_at", null)
      : supabase.from("products").select("id, line_id, shade, type, package_size, ratio").is("deleted_at", null),
  ]);
  const byId = new Map(lines.map((l) => [l.id, l]));
  return (data ?? []).flatMap((p) => {
    const line = byId.get(p.line_id);
    if (!line) return [];
    return [
      {
        id: p.id,
        line_id: p.line_id,
        brand: line.brand,
        line: line.name,
        shade: p.shade,
        type: p.type,
        package_size: p.package_size,
        ratio: p.ratio,
        line_ratio: line.default_ratio,
        purchase_price: "purchase_price" in p ? (p.purchase_price as number | null) : null,
      },
    ];
  });
});

export const getProduct = cache(async (id: string, withPrice: boolean): Promise<CatalogProduct | null> => {
  if (!isUuid(id)) return null;
  const products = await getProducts(withPrice);
  return products.find((p) => p.id === id) ?? null;
});

export const getLine = cache(async (id: string): Promise<CatalogLine | null> => {
  if (!isUuid(id)) return null;
  return (await getLines()).find((l) => l.id === id) ?? null;
});

export const countOpenRequests = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("product_requests")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null)
    .is("deleted_at", null);
  return count ?? 0;
});

export function productLabel(p: { brand: string; line: string; shade: string }): string {
  return [p.brand, p.line, p.shade].filter(Boolean).join(" ");
}
