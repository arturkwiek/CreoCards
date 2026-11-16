import "server-only";
import { cache } from "react";
import { warsawDate, type ClientFormValues } from "@/lib/clients/form";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aktywna klientka salonu (RLS) albo null – także dla nieprawidłowego id i usuniętych. */
export const getClient = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, full_name, phone, allergy_status, allergies, email, note, rodo_consent_at, notifications_consent_at, photo_consent_at, created_at, updated_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
});

export type ClientRecord = NonNullable<Awaited<ReturnType<typeof getClient>>>;

export function toFormValues(client: ClientRecord): ClientFormValues {
  return {
    full_name: client.full_name,
    phone: client.phone,
    allergy_status: client.allergy_status,
    allergies: client.allergies,
    email: client.email ?? "",
    note: client.note,
    rodo_consent: client.rodo_consent_at !== null,
    notifications_consent: client.notifications_consent_at !== null,
    photo_consent_date: client.photo_consent_at ? warsawDate(client.photo_consent_at) : "",
  };
}
