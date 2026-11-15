"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import type { PasswordLinkType } from "@/lib/auth/invite-link";
import { createAuthLink, EMAIL_EXISTS_MESSAGE, type GenerateLink } from "@/lib/auth/password-link";
import { requireOwner } from "@/lib/auth/session";
import { isAuthEmailEnabled } from "@/lib/features";
import { getRequestOrigin } from "@/lib/request-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formString, isValidEmail, normalizeEmail, parseRole } from "@/lib/validation";
import { LOGIN_RULES, isTechnicalEmail, isValidLogin, normalizeLogin, technicalEmail } from "@/lib/auth/login";
import { generateTempPassword } from "@/lib/auth/temp-password";

/** Blokada w Supabase Auth: ~100 lat (unieważnia odświeżanie sesji). */
const BAN_FOREVER = "876000h";

export type InviteState = FormState & { link?: string };

/** generateLink z admin API (klucz service_role) – tylko po stronie serwera. */
const generateLink: GenerateLink = (type, email) => {
  const admin = createAdminClient().auth.admin;
  return type === "invite"
    ? admin.generateLink({ type: "invite", email })
    : admin.generateLink({ type: "recovery", email });
};

/**
 * Jednorazowy link (zaproszenie albo ustawienie hasła) bez wysyłania e-maila.
 * Zaproszenie tworzy konto Auth, jeśli jeszcze nie istnieje. Wywoływać tylko po requireOwner().
 */
async function generateAuthLink(email: string, type: PasswordLinkType) {
  return createAuthLink(generateLink, await getRequestOrigin(), email, type);
}

export type AddMemberState = InviteState & { tempPassword?: string };

const LOGIN_TAKEN = "Ten login jest już zajęty w salonie – wybierz inny.";

/**
 * Nowa osoba w zespole: login (obowiązkowy) + rola, e-mail opcjonalny.
 * – Z e-mailem: zaproszenie jak dotąd (link albo e-mail), login zapisany w zaproszeniu.
 * – Bez e-maila: konto od razu (admin API, adres techniczny, potwierdzone, bez wysyłki),
 *   potem link do ustawienia hasła (domyślnie) albo hasło tymczasowe z wymuszoną zmianą.
 * Wpis w invitations idzie przez RLS (tylko właścicielka swojego salonu); profil zakłada trigger.
 */
export async function addMember(_prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  await requireOwner();

  const login = normalizeLogin(formData.get("login"));
  const emailInput = formString(formData, "email").trim();
  const email = normalizeEmail(emailInput);
  const role = parseRole(formData.get("role"));
  const fullName = formString(formData, "full_name").trim().slice(0, 120);
  const delivery = formString(formData, "delivery");
  if (!isValidLogin(login)) return { error: `Login: ${LOGIN_RULES}.` };
  if (emailInput && (!isValidEmail(email) || isTechnicalEmail(email))) return { error: "Podaj poprawny adres e-mail albo zostaw pole puste." };
  if (!role) return { error: "Wybierz rolę." };

  const supabase = await createClient();
  const { data: salonId } = await supabase.rpc("current_salon_id");
  if (!salonId) return { error: "Brak dostępu do salonu." };

  const { data: taken } = await supabase.from("users").select("id").eq("login", login).maybeSingle();
  if (taken) return { error: LOGIN_TAKEN };

  if (email) {
    const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (existing) {
      return {
        error:
          "Ta osoba ma już konto w salonie – nadaj jej login przy nazwisku na liście poniżej albo użyj „Utwórz link do ustawienia hasła”.",
      };
    }
  }

  const accountEmail = email || technicalEmail(login, salonId);
  const { data: invitation, error: insertError } = await supabase
    .from("invitations")
    .insert({ email: accountEmail, role, full_name: fullName, login })
    .select("id")
    .single();
  if (insertError || !invitation) {
    if (insertError?.code === "23505") {
      return {
        error: email
          ? "Na ten adres albo login czeka już zaproszenie – użyj „Kopiuj link zaproszenia” na liście poniżej."
          : LOGIN_TAKEN,
      };
    }
    return { error: "Nie udało się założyć konta." };
  }

  let result: AddMemberState;
  if (email) {
    // Bez własnego SMTP e-mail nie dociera – wtedy zawsze link (także przy spreparowanym formularzu).
    if (delivery === "email" && isAuthEmailEnabled()) {
      const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email);
      result = error
        ? {
            error:
              error.code === "email_exists"
                ? EMAIL_EXISTS_MESSAGE
                : "Nie udało się wysłać e-maila. Spróbuj „Utwórz link do ustawienia hasła”.",
          }
        : { success: `Wysłano zaproszenie na ${email}. Login: ${login}.` };
    } else {
      const { link, error } = await generateAuthLink(email, "invite");
      result = error ? { error } : { link, success: `Konto dla „${login}” gotowe – przekaż link do ustawienia hasła.` };
    }
  } else {
    // Konto bez e-maila: potwierdzone od razu, nic nie jest wysyłane; trigger zakłada profil z loginem.
    const admin = createAdminClient().auth.admin;
    const { data: created, error } = await admin.createUser({ email: accountEmail, email_confirm: true });
    if (error || !created.user) {
      result = { error: "Nie udało się założyć konta. Spróbuj ponownie." };
    } else if (delivery === "temp") {
      const tempPassword = generateTempPassword();
      const { error: pwError } = await admin.updateUserById(created.user.id, {
        password: tempPassword,
        app_metadata: { must_change_password: true },
      });
      result = pwError
        ? { error: "Konto założone, ale nie udało się ustawić hasła – użyj „Utwórz link do ustawienia hasła” na liście." }
        : { tempPassword, success: `Konto „${login}” gotowe. Przekaż login i hasło tymczasowe – przy pierwszym logowaniu trzeba je zmienić.` };
      revalidatePath("/zespol");
      return result;
    } else {
      const { link, error: linkError } = await generateAuthLink(accountEmail, "recovery");
      result = linkError
        ? { error: "Konto założone, ale nie udało się utworzyć linku – użyj „Utwórz link do ustawienia hasła” na liście." }
        : { link, success: `Konto „${login}” gotowe – przekaż link do ustawienia hasła.` };
      revalidatePath("/zespol");
      return result;
    }
  }

  if (result.error) {
    // Wycofanie zaproszenia (miękko), żeby można było spróbować ponownie.
    await supabase.from("invitations").update({ deleted_at: new Date().toISOString() }).eq("id", invitation.id);
    return result;
  }

  revalidatePath("/zespol");
  return result;
}

/** Nadanie lub zmiana loginu osobie z zespołu (RLS + trigger: tylko właścicielka). */
export async function setMemberLogin(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireOwner();
  const id = formString(formData, "id");
  const login = normalizeLogin(formData.get("login"));
  if (!isValidLogin(login)) return { error: `Login: ${LOGIN_RULES}.` };

  const supabase = await createClient();
  const { data, error } = await supabase.from("users").update({ login }).eq("id", id).select("id");
  if (error?.code === "23505") return { error: LOGIN_TAKEN };
  if (error || !data?.length) return { error: "Nie udało się zapisać loginu." };
  revalidatePath("/zespol");
  return { success: `Login zapisany: ${login}.` };
}

/** Hasło tymczasowe (opcja zapasowa) – pokazywane raz, przy pierwszym logowaniu wymuszona zmiana. */
export async function setTemporaryPassword(_prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const owner = await requireOwner();
  const id = formString(formData, "id");
  if (!id || id === owner.id) return { error: "Nie można ustawić hasła dla tego konta." };

  const supabase = await createClient();
  const { data: member } = await supabase.from("users").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!member) return { error: "Konto jest dezaktywowane albo nie należy do salonu." };

  const tempPassword = generateTempPassword();
  const { error } = await createAdminClient().auth.admin.updateUserById(member.id, {
    password: tempPassword,
    app_metadata: { must_change_password: true },
  });
  return error ? { error: "Nie udało się ustawić hasła tymczasowego." } : { tempPassword };
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

  const { link, error } = await generateAuthLink(invitation.email, "invite");
  return error ? { error } : { link };
}

/**
 * Link do ustawienia hasła dla aktywnej osoby z zespołu (np. zaproszenie e-mailem nie dotarło
 * albo zapomniała hasła, a własnego SMTP jeszcze nie ma). Osobę wyszukuje RLS – tylko w salonie
 * właścicielki. Dezaktywowanej osobie najpierw trzeba przywrócić dostęp.
 */
export async function createPasswordLink(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const owner = await requireOwner();
  const id = formString(formData, "id");
  if (!id || id === owner.id) return { error: "Nie można utworzyć linku dla tego konta." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("users")
    .select("email")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!member) return { error: "Konto jest dezaktywowane albo nie należy do salonu." };

  const { link, error } = await generateAuthLink(member.email, "recovery");
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
