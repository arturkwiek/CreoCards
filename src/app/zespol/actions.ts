"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { buildInviteLink } from "@/lib/auth/invite-link";
import { requireOwner } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/request-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formString, isValidEmail, normalizeEmail, parseRole } from "@/lib/validation";

/** Blokada w Supabase Auth: ~100 lat (unieważnia odświeżanie sesji). */
const BAN_FOREVER = "876000h";

export type InviteState = FormState & { link?: string };

const EMAIL_EXISTS_MESSAGE = "Ten adres ma już konto w CreoCards (np. w innym salonie).";

/**
 * Jednorazowy link zaproszenia (bez wysyłania e-maila). Tworzy konto Auth, jeśli jeszcze
 * nie istnieje; każdy nowy link unieważnia poprzedni. Wywoływać tylko po requireOwner().
 */
async function generateInviteLink(email: string): Promise<{ link?: string; error?: string }> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "invite",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    return {
      error:
        error?.code === "email_exists"
          ? EMAIL_EXISTS_MESSAGE
          : "Nie udało się utworzyć linku zaproszenia.",
    };
  }
  return { link: buildInviteLink(await getRequestOrigin(), data.properties.hashed_token) };
}

/**
 * Zaproszenie: najpierw wpis w invitations przez RLS (tylko właścicielka swojego salonu),
 * potem e-mail przez admin API albo link do przekazania (delivery=link).
 * Profil powstaje po przyjęciu zaproszenia (trigger w bazie).
 */
export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireOwner();

  const email = normalizeEmail(formData.get("email"));
  const role = parseRole(formData.get("role"));
  const fullName = formString(formData, "full_name").trim().slice(0, 120);
  const byLink = formString(formData, "delivery") === "link";
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
          ? "Zaproszenie na ten adres już czeka na przyjęcie – użyj „Kopiuj link zaproszenia” na liście poniżej."
          : "Nie udało się utworzyć zaproszenia.",
    };
  }

  let result: InviteState;
  if (byLink) {
    const { link, error } = await generateInviteLink(email);
    result = error ? { error } : { link, success: `Zaproszenie dla ${email} gotowe – przekaż link.` };
  } else {
    const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email);
    result = error
      ? {
          error:
            error.code === "email_exists"
              ? EMAIL_EXISTS_MESSAGE
              : "Nie udało się wysłać e-maila. Spróbuj „Utwórz link zaproszenia”.",
        }
      : { success: `Wysłano zaproszenie na ${email}.` };
  }

  if (result.error) {
    // Wycofanie (miękko), żeby można było spróbować ponownie.
    await supabase
      .from("invitations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", invitation.id);
    return result;
  }

  revalidatePath("/zespol");
  return result;
}

/** Nowy link dla oczekującego zaproszenia (np. gdy e-mail nie dotarł). */
export async function createInviteLink(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireOwner();
  const id = formString(formData, "id");
  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("invitations")
    .select("email")
    .eq("id", id)
    .is("accepted_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (!invitation) return { error: "Zaproszenie nie jest już aktywne." };

  const { link, error } = await generateInviteLink(invitation.email);
  return error ? { error } : { link };
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
