"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/catalog/form";
import { parsePrice } from "@/lib/catalog/values";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";
import { findOxidant, parseRecipe } from "@/lib/visits/recipe";
import { fromWarsawLocal } from "@/lib/visits/time";
import { getProducts } from "../katalog/data";
import { getVisit } from "./data";

// Uwaga: nie logujemy treści formularza (dane klientki).

export type VisitFormState = {
  error?: string;
  /** Wizyta zapisana, ale receptura nie – kolejny zapis aktualizuje tę wizytę zamiast tworzyć nową. */
  visitId?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nowa wizyta (bez id) lub edycja: data, usługa, cena + receptura (save_recipe). Po zapisie – karta klientki. */
export async function saveVisit(prev: VisitFormState, formData: FormData): Promise<VisitFormState> {
  const user = await requireUser();
  const id = formString(formData, "id") || prev.visitId || "";
  const clientId = formString(formData, "client_id");
  if ((id && !isUuid(id)) || !isUuid(clientId)) return { error: "Nie znaleziono wizyty." };

  const serviceId = formString(formData, "service_id");
  if (serviceId && !isUuid(serviceId)) return { error: "Wybierz usługę z listy." };

  const visitAt = fromWarsawLocal(formString(formData, "visit_at"));
  if (!visitAt) return { error: "Podaj datę wizyty." };
  if (visitAt.getTime() > Date.now() + DAY_MS) return { error: "Data wizyty nie może być w przyszłości." };
  if (visitAt.getUTCFullYear() < 2000) return { error: "Nieprawidłowa data wizyty." };

  const price = parsePrice(formString(formData, "price"));
  if (price === "invalid") return { error: "Cena: podaj kwotę, np. 180." };

  const products = await getProducts(false);
  const parsed = parseRecipe(formString(formData, "recipe"), new Set(products.map((p) => p.id)));
  if (parsed.error !== undefined) return { error: parsed.error };

  const supabase = await createClient();
  const fields = { service_id: serviceId || null, visit_at: visitAt.toISOString(), price };
  let visitId = id;

  if (id) {
    const existing = await getVisit(id);
    if (!existing || existing.client_id !== clientId) return { error: "Nie znaleziono wizyty." };
    if (existing.created_by !== user.id && user.role !== "owner") {
      return { error: "Tę wizytę może zmienić tylko jej autorka lub właścicielka." };
    }
    const { error } = await supabase.from("visits").update(fields).eq("id", id).is("deleted_at", null);
    if (error) return { error: "Nie udało się zapisać wizyty. Spróbuj ponownie.", visitId: prev.visitId };
  } else {
    const { data, error } = await supabase
      .from("visits")
      .insert({ ...fields, client_id: clientId })
      .select("id")
      .single();
    if (error || !data) return { error: "Nie udało się zapisać wizyty. Spróbuj ponownie." };
    visitId = data.id;
  }

  // Utleniacz z katalogu: ta sama marka co pierwsza farba, wybrane stężenie (pod magazyn w Etapie 8).
  const byId = new Map(products.map((p) => [p.id, p]));
  const recipe = {
    note: parsed.recipe.note,
    mixes: parsed.recipe.mixes.map((m) => ({
      ...m,
      oxidant_product_id: findOxidant(products, byId.get(m.items[0]?.product_id ?? "")?.brand, m.oxidant_percent),
    })),
  };
  const { error: recipeError } = await supabase.rpc("save_recipe", { p_visit_id: visitId, p_recipe: recipe });
  if (recipeError) {
    return { error: "Wizyta zapisana, ale receptury nie udało się zapisać. Spróbuj ponownie.", visitId };
  }

  revalidatePath(`/klientki/${clientId}`);
  redirect(`/klientki/${clientId}`);
}

/** Miękkie usunięcie wizyty – tylko właścicielka (sprawdza też trigger w bazie). */
export async function deleteVisit(formData: FormData): Promise<void> {
  await requireOwner();
  const id = formString(formData, "id");
  const visit = await getVisit(id);
  if (!visit) return;
  const supabase = await createClient();
  await supabase.from("visits").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
  revalidatePath(`/klientki/${visit.client_id}`);
  redirect(`/klientki/${visit.client_id}`);
}
