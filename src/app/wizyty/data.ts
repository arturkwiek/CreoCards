import "server-only";
import { cache } from "react";
import { isUuid } from "@/lib/catalog/form";
import { createClient } from "@/lib/supabase/server";
import type { DraftMix, DraftRecipe } from "@/lib/visits/recipe";

export type Service = {
  id: string;
  name: string;
  price_from: number | null;
  price_to: number | null;
  duration_min: number | null;
  with_color: boolean;
};

export const getServices = cache(async (): Promise<Service[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, price_from, price_to, duration_min, with_color")
    .is("deleted_at", null)
    .order("position")
    .order("name");
  return data ?? [];
});

/** Nazwy wszystkich usług – także usuniętych z listy (historia wizyt je zachowuje). */
export const getServiceNames = cache(async (): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id, name");
  return new Map((data ?? []).map((s) => [s.id, s.name]));
});

export const getService = cache(async (id: string): Promise<Service | null> => {
  if (!isUuid(id)) return null;
  return (await getServices()).find((s) => s.id === id) ?? null;
});

/** Aktywne receptury wizyt (mieszanki i farby w kolejności zapisu). */
export async function getRecipes(visitIds: readonly string[]): Promise<Map<string, DraftRecipe>> {
  const result = new Map<string, DraftRecipe>();
  if (visitIds.length === 0) return result;
  const supabase = await createClient();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, visit_id, note")
    .in("visit_id", [...visitIds])
    .is("deleted_at", null);
  if (!recipes || recipes.length === 0) return result;

  const { data: mixes } = await supabase
    .from("recipe_mixes")
    .select("id, recipe_id, position, zone, oxidant_percent, ratio, processing_minutes")
    .in("recipe_id", recipes.map((r) => r.id))
    .is("deleted_at", null)
    .order("position");
  const { data: items } = mixes?.length
    ? await supabase
        .from("mix_items")
        .select("mix_id, product_id, grams, position")
        .in("mix_id", mixes.map((m) => m.id))
        .is("deleted_at", null)
        .order("position")
    : { data: [] };

  const byRecipe = new Map<string, DraftMix[]>();
  for (const m of mixes ?? []) {
    const list = byRecipe.get(m.recipe_id) ?? [];
    list.push({
      zone: m.zone,
      oxidant_percent: m.oxidant_percent,
      ratio: m.ratio,
      processing_minutes: m.processing_minutes,
      items: (items ?? []).filter((i) => i.mix_id === m.id).map((i) => ({ product_id: i.product_id, grams: i.grams })),
    });
    byRecipe.set(m.recipe_id, list);
  }
  for (const r of recipes) result.set(r.visit_id, { note: r.note, mixes: byRecipe.get(r.id) ?? [] });
  return result;
}

/** Etykiety produktów („Marka 7.1”) – także produktów usuniętych później z katalogu. */
export async function getProductLabels(recipes: Iterable<DraftRecipe>): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const r of recipes) for (const m of r.mixes) for (const i of m.items) ids.add(i.product_id);
  const labels = new Map<string, string>();
  if (ids.size === 0) return labels;
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("id, shade, line_id").in("id", [...ids]);
  const lineIds = [...new Set((products ?? []).map((p) => p.line_id))];
  const { data: lines } = await supabase.from("product_lines").select("id, brand").in("id", lineIds);
  const brands = new Map((lines ?? []).map((l) => [l.id, l.brand]));
  for (const p of products ?? []) labels.set(p.id, `${brands.get(p.line_id) ?? ""} ${p.shade}`.trim());
  return labels;
}

export type VisitRecord = {
  id: string;
  client_id: string;
  service_id: string | null;
  visit_at: string;
  price: number | null;
  created_by: string;
};

export const getVisit = cache(async (id: string): Promise<VisitRecord | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id, client_id, service_id, visit_at, price, created_by")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
});

export async function getClientVisits(clientId: string): Promise<VisitRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id, client_id, service_id, visit_at, price, created_by")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("visit_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

/** „Powtórz ostatnią recepturę”: ostatnia wizyta klientki, która MA recepturę (z mieszankami). */
export async function getLastRecipe(clientId: string, excludeVisitId?: string): Promise<DraftRecipe | null> {
  const visits = (await getClientVisits(clientId)).filter((v) => v.id !== excludeVisitId);
  const recipes = await getRecipes(visits.map((v) => v.id));
  for (const v of visits) {
    const recipe = recipes.get(v.id);
    if (recipe && recipe.mixes.length > 0) return recipe;
  }
  return null;
}

export const getTeamNames = cache(async (): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("id, full_name, email");
  return new Map((data ?? []).map((u) => [u.id, u.full_name || u.email]));
});

/** Ile razy produkt użyto w recepturach salonu. */
export const getUsage = cache(async (): Promise<Map<string, number>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("product_usage");
  return new Map((data ?? []).map((r) => [r.product_id, Number(r.uses)]));
});
