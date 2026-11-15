"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { isUuid } from "@/lib/catalog/form";
import { IMPORT_MAX_BYTES } from "@/lib/catalog/import";
import { validateServiceForm, type ServiceFormErrors, type ServiceFormValues } from "@/lib/services/form";
import { parseServicesCsv, planServices } from "@/lib/services/import";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";
import { getServices } from "../wizyty/data";

const UNIQUE_VIOLATION = "23505";

export type ServiceFormState = { values?: ServiceFormValues; errors?: ServiceFormErrors; error?: string };

export async function saveService(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  await requireOwner();
  const id = formString(formData, "id");
  if (id && !isUuid(id)) return { error: "Nie znaleziono usługi." };
  const values: ServiceFormValues = {
    name: formString(formData, "name"),
    price_from: formString(formData, "price_from"),
    price_to: formString(formData, "price_to"),
    duration_min: formString(formData, "duration_min"),
    with_color: formString(formData, "with_color") === "on",
  };
  const result = validateServiceForm(values);
  if (result.errors) return { values, errors: result.errors };

  const supabase = await createClient();
  let error;
  if (id) {
    ({ error } = await supabase.from("services").update(result.data).eq("id", id).is("deleted_at", null));
  } else {
    const position = (await getServices()).length;
    ({ error } = await supabase.from("services").insert({ ...result.data, position }));
  }
  if (error?.code === UNIQUE_VIOLATION) return { values, errors: { name: "Taka usługa już jest na liście." } };
  if (error) return { values, error: "Nie udało się zapisać usługi. Spróbuj ponownie." };

  revalidatePath("/uslugi");
  redirect("/uslugi");
}

/** Miękkie usunięcie usługi (zapisane wizyty ją zachowują). */
export async function deleteService(formData: FormData): Promise<void> {
  await requireOwner();
  const id = formString(formData, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("services").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
  revalidatePath("/uslugi");
  redirect("/uslugi");
}

// ---------------------------------------------------------------------------
// Import CSV z zakładki „Usługi”: 1) podgląd, 2) zapis (import_services – wszystko albo nic)
// ---------------------------------------------------------------------------

export type ServicesPreviewState = {
  fatal?: string;
  csv?: string;
  fileName?: string;
  plan?: ReturnType<typeof planServices>;
  errors?: { row: number; message: string }[];
  warnings?: string[];
  count?: number;
};

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

export async function previewServicesImport(
  _prev: ServicesPreviewState,
  formData: FormData,
): Promise<ServicesPreviewState> {
  await requireOwner();
  const input = await readCsvInput(formData);
  if ("fatal" in input) return { fatal: input.fatal };
  const parsed = parseServicesCsv(input.csv);
  if (parsed.fatal) return { fatal: parsed.fatal, fileName: input.fileName };
  const plan = planServices(parsed.items, await getServices());
  return {
    csv: input.csv,
    fileName: input.fileName,
    plan,
    errors: parsed.errors,
    warnings: parsed.warnings,
    count: parsed.items.length,
  };
}

export type ServicesRunState = { error?: string; result?: { created: number; updated: number } };

export async function runServicesImport(_prev: ServicesRunState, formData: FormData): Promise<ServicesRunState> {
  await requireOwner();
  const input = await readCsvInput(formData);
  if ("fatal" in input) return { error: input.fatal };
  const parsed = parseServicesCsv(input.csv);
  if (parsed.fatal) return { error: parsed.fatal };
  if (parsed.items.length === 0) return { error: "Brak poprawnych wierszy do zaimportowania." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_services", { items: parsed.items });
  if (error || !data) return { error: "Import nie powiódł się – nic nie zostało zapisane. Spróbuj ponownie." };
  revalidatePath("/uslugi");
  return { result: data as ServicesRunState["result"] };
}
