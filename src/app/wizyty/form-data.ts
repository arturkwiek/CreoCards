import "server-only";
import { compareProducts } from "@/lib/catalog/search";
import { byUsage } from "@/lib/visits/recipe";
import { getProducts } from "../katalog/data";
import { getLastRecipe, getServices, getUsage } from "./data";
import type { VisitProduct } from "./visit-form";

/** Dane formularza wizyty: usługi, farby (bez utleniaczy, najczęściej używane na górze), ostatnia receptura. */
export async function loadVisitFormData(clientId: string, excludeVisitId?: string) {
  const [services, products, usage, lastRecipe] = await Promise.all([
    getServices(),
    getProducts(false),
    getUsage(),
    getLastRecipe(clientId, excludeVisitId),
  ]);
  const dyes: VisitProduct[] = byUsage(
    products.filter((p) => p.type !== "utleniacz").sort(compareProducts),
    usage,
  ).map(({ id, brand, line, shade, type, ratio, line_ratio }) => ({ id, brand, line, shade, type, ratio, line_ratio }));
  return { services, products: dyes, lastRecipe };
}
