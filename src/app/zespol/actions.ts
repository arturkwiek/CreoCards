"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireOwner } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formString, isValidEmail, normalizeEmail, parseRole } from "@/lib/validation";

/** Blokada w Supabase Auth: ~100 lat (unieważnia odświeżanie sesji). */
const BAN_FOREVER = "876000h";

/**
 * Zaproszenie: najpierw wpis w invitations przez RLS (tylko właścicielka swojego salonu),
 * dopiero potem e-mail przez admin API. Profil powstaje po przyjęciu zaproszenia (trigger w bazie).
 */
export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();

  const email = normalizeEmail(formData.get("email"));
  const role = parseRole(formData.get("role"));
  const fullName = formString(formData, "full_name").trim().slice(0, 120);
  if (!isValidEmail(email)) return { error: "Podaj poprawny adres e-mail." };
  if (!role) return { error: "Wybierz rolę." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: "Ta osoba ma już konto w salonie." };

  const { data: invitation, error: insertError } = await supabase
    .from("invitations")
    .insert({ email, role, full_name: fullName })
    .select("id")
    .single();

  if (insertError || !invitation) {
    return {
      error:
        insertError?.code === "23505"
          ? "Zaproszenie na ten adres już czeka na przyjęcie."
          : "Nie udało się utworzyć zaproszenia.",
    };
  }

  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    // Wycofanie (miękko), żeby można było spróbować ponownie.
    await supabase
      .from("invitations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", invitation.id);
    return {
      error:
        inviteError.code === "email_exists"
          ? "Ten adres ma już konto w CreoCards (np. w innym salonie)."
          : "Nie udało się wysłać zaproszenia. Spróbuj ponownie.",
    };
  }

  revalidatePath("/zespol");
  return { success: `Wysłano zaproszenie na ${email}.` };
}

export async function cancelInvitation(formData: FormData): Promise<void> {
  await requireOwner();
  const id = formString(formData, "id");
  const supabase = await createClient();
  await supabase
    .from("invitations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null);
  revalidatePath("/zespol");
}

/** Dezaktywacja: deleted_at przez RLS (trigger blokuje własne konto), potem ban w Supabase Auth. */
export async function deactivateMember(formData: FormData): Promise<void> {
  await requireOwner();
  const id = formString(formData, "id");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error || !data?.length) return;

  await createAdminClient().auth.admin.updateUserById(id, { ban_duration: BAN_FOREVER });
  revalidatePath("/zespol");
}

export async function reactivateMember(formData: FormData): Promise<void> {
  await requireOwner();
  const id = formString(formData, "id");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error || !data?.length) return;

  await createAdminClient().auth.admin.updateUserById(id, { ban_duration: "none" });
  revalidatePath("/zespol");
}
