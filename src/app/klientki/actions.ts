"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireUser } from "@/lib/auth/session";
import {
  consentTimestamp,
  readClientForm,
  validateClientForm,
  type ClientFormErrors,
  type ClientFormValues,
} from "@/lib/clients/form";
import { normalizePhone, phoneDigits } from "@/lib/clients/phone";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";

// Uwaga: alergie to dane wrażliwe – nie logujemy treści formularza ani błędów z danymi.

export type ClientFormState = {
  values?: ClientFormValues;
  errors?: ClientFormErrors;
  error?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dodanie (bez id) lub edycja klientki. Po zapisie – karta klientki. */
export async function saveClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  await requireUser();
  const id = formString(formData, "id");
  if (id && !UUID.test(id)) return { error: "Nie znaleziono klientki." };

  const values = readClientForm(formData);
  const result = validateClientForm(values);
  if (result.errors) return { values, errors: result.errors };

  const supabase = await createClient();
  const now = new Date().toISOString();
  let clientId = id;

  if (!id) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        ...result.data,
        rodo_consent_at: consentTimestamp(values.rodo_consent, null, now),
        notifications_consent_at: consentTimestamp(values.notifications_consent, null, now),
      })
      .select("id")
      .single();
    if (error || !data) return { values, error: "Nie udało się zapisać klientki. Spróbuj ponownie." };
    clientId = data.id;
  } else {
    const { data: existing } = await supabase
      .from("clients")
      .select("rodo_consent_at, notifications_consent_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return { values, error: "Nie znaleziono klientki." };

    const { error } = await supabase
      .from("clients")
      .update({
        ...result.data,
        rodo_consent_at: consentTimestamp(values.rodo_consent, existing.rodo_consent_at, now),
        notifications_consent_at: consentTimestamp(
          values.notifications_consent,
          existing.notifications_consent_at,
          now,
        ),
      })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) return { values, error: "Nie udało się zapisać zmian. Spróbuj ponownie." };
  }

  revalidatePath("/klientki");
  redirect(`/klientki/${clientId}`);
}

export type PhoneMatch = { id: string; full_name: string };

/** Ostrzeżenie o tym samym numerze (nie blokuje zapisu). */
export async function findClientsWithPhone(phone: string, excludeId?: string): Promise<PhoneMatch[]> {
  await requireUser();
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, full_name")
    .eq("phone_digits", phoneDigits(normalized))
    .is("deleted_at", null)
    .limit(3);
  if (excludeId && UUID.test(excludeId)) query = query.neq("id", excludeId);

  const { data } = await query;
  return data ?? [];
}

/** Miękkie usunięcie – tylko właścicielka (sprawdza też trigger w bazie). */
export async function deleteClient(formData: FormData): Promise<void> {
  await requireOwner();
  const id = formString(formData, "id");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath("/klientki");
  redirect("/klientki");
}
