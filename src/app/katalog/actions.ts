"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireUser } from "@/lib/auth/session";
import {
  isUuid,
  readProductForm,
  validateLineForm,
  validateProductForm,
  validateRequest,
  type LineFormErrors,
  type LineFormValues,
  type ProductFormErrors,
  type ProductFormValues,
} from "@/lib/catalog/form";
import {
  IMPORT_MAX_BYTES,
  parseImport,
  planImport,
  type ImportIssue,
  type ImportPlan,
} from "@/lib/catalog/import";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";
import { getLines, getProducts } from "./data";

const UNIQUE_VIOLATION = "23505";

// ---------------------------------------------------------------------------
// Produkty i linie (tylko właścicielka; RLS sprawdza to także w bazie)
// ---------------------------------------------------------------------------

export type ProductFormState = { values?: ProductFormValues; errors?: ProductFormErrors; error?: string };

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireOwner();
  const id = formString(formData, "id");
  if (id && !isUuid(id)) return { error: "Nie znaleziono produktu." };

  const values = readProductForm(formData);
  const result = validateProductForm(values);
  if (result.errors) return { values, errors: result.errors };

  const supabase = await createClient();
  const { line, product } = result.data;
  let lineId: string;

  if ("id" in line) {
    lineId = line.id;
  } else {
    const { data, error } = await supabase.from("product_lines").insert(line).select("id").single();
    if (error?.code === UNIQUE_VIOLATION) {
      return { values, errors: { brand: "Ta marka i linia już jest w katalogu – wybierz ją z listy." } };
    }
    if (error || !data) return { values, error: "Nie udało się zapisać linii. Spróbuj ponownie." };
    lineId = data.id;
  }

  const row = { ...product, line_id: lineId };
  const { data, error } = id
    ? await supabase.from("products").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("products").insert(row).select("id").single();

  if (error?.code === UNIQUE_VIOLATION) {
    return { values: { ...values, line_id: lineId }, errors: { shade: "Ten odcień jest już w tej linii." } };
  }
  if (error || !data) return { values: { ...values, line_id: lineId }, error: "Nie udało się zapisać produktu." };

  revalidatePath("/katalog");
  // Po dodaniu: kolejny produkt w tej samej linii (identyfikatory katalogu to nie dane osobowe).
  redirect(id ? "/katalog" : `/katalog/nowy?linia=${lineId}&dodano=${data.id}`);
}

/** Miękkie usunięcie produktu. */
export async function deleteProduct(formData: FormData): Promise<void> {
  await requireOwner();
  const id = formString(formData, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
  revalidatePath("/katalog");
  redirect("/katalog");
}

export type LineFormState = { values?: LineFormValues; errors?: LineFormErrors; error?: string };

export async function saveLine(_prev: LineFormState, formData: FormData): Promise<LineFormState> {
  await requireOwner();
  const id = formString(formData, "id");
  if (!isUuid(id)) return { error: "Nie znaleziono linii." };
  const values: LineFormValues = {
    brand: formString(formData, "brand"),
    name: formString(formData, "name"),
    default_ratio: formString(formData, "default_ratio"),
  };
  const result = validateLineForm(values);
  if (result.errors) return { values, errors: result.errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_lines")
    .update(result.data)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error?.code === UNIQUE_VIOLATION) return { values, errors: { name: "Taka marka i linia już istnieje." } };
  if (error || !data) return { values, error: "Nie udało się zapisać linii." };

  revalidatePath("/katalog");
  redirect("/katalog");
}

// ---------------------------------------------------------------------------
// „Zgłoś brak” – każda aktywna osoba; „Załatwione” – właścicielka
// ---------------------------------------------------------------------------

export type RequestFormState = { error?: string; done?: boolean };

export async function createRequest(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  await requireUser();
  const input = validateRequest(
    formString(formData, "kind"),
    formString(formData, "product_id"),
    formString(formData, "description"),
  );
  if (typeof input === "string") return { error: input };

  const supabase = await createClient();
  const { error } = await supabase.from("product_requests").insert(input);
  if (error) return { error: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie." };

  revalidatePath("/katalog");
  revalidatePath("/");
  return { done: true };
}

export async function resolveRequest(formData: FormData): Promise<void> {
  const user = await requireOwner();
  const id = formString(formData, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase
    .from("product_requests")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", id)
    .is("resolved_at", null);
  revalidatePath("/katalog");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Import CSV: 1) podgląd, 2) zapis w jednej transakcji (import_products)
// ---------------------------------------------------------------------------

export type ImportPreviewState = {
  fatal?: string;
  csv?: string;
  fileName?: string;
  plan?: ImportPlan;
  errors?: ImportIssue[];
  warnings?: string[];
  count?: number;
};

/** Plik z arkusza zwykle jest w UTF-8; eksport ze starszego Excela – w Windows-1250. */
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1250").decode(buffer);
  }
}

async function readCsvInput(formData: FormData): Promise<{ csv: string; fileName: string } | { fatal: string }> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > IMPORT_MAX_BYTES) return { fatal: "Plik jest za duży (maks. 500 KB)." };
    return { csv: decodeCsv(await file.arrayBuffer()), fileName: file.name };
  }
  const csv = formString(formData, "csv");
  if (!csv) return { fatal: "Wybierz plik CSV." };
  if (csv.length > IMPORT_MAX_BYTES) return { fatal: "Plik jest za duży (maks. 500 KB)." };
  return { csv, fileName: formString(formData, "file_name") };
}

export async function previewImport(_prev: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  await requireOwner();
  const input = await readCsvInput(formData);
  if ("fatal" in input) return { fatal: input.fatal };

  const parsed = parseImport(input.csv);
  if (parsed.fatal) return { fatal: parsed.fatal, fileName: input.fileName };

  const [lines, products] = await Promise.all([getLines(), getProducts(true)]);
  const plan = planImport(parsed.items, lines, products);
  return {
    csv: input.csv,
    fileName: input.fileName,
    plan,
    errors: parsed.errors,
    warnings: parsed.warnings,
    count: parsed.items.length,
  };
}

export type ImportRunState = {
  error?: string;
  result?: { lines_created: number; lines_updated: number; products_created: number; products_updated: number };
};

export async function runImport(_prev: ImportRunState, formData: FormData): Promise<ImportRunState> {
  await requireOwner();
  const input = await readCsvInput(formData);
  if ("fatal" in input) return { error: input.fatal };

  // Ponowne przetworzenie tego samego pliku – serwer nie ufa danym z podglądu.
  const parsed = parseImport(input.csv);
  if (parsed.fatal) return { error: parsed.fatal };
  if (parsed.items.length === 0) return { error: "Brak poprawnych wierszy do zaimportowania." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_products", { items: parsed.items });
  if (error || !data) return { error: "Import nie powiódł się – nic nie zostało zapisane. Spróbuj ponownie." };

  revalidatePath("/katalog");
  return { result: data as ImportRunState["result"] };
}
