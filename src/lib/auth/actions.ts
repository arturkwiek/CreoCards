"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formString,
  isValidEmail,
  normalizeEmail,
  validatePassword,
} from "@/lib/validation";
import { LOGIN_PATH } from "./paths";

export type FormState = { error?: string; success?: string };

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(formData.get("email"));
  const password = formString(formData, "password");
  if (!isValidEmail(email) || !password) {
    return { error: "Podaj e-mail i hasło." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Nieprawidłowy e-mail lub hasło." };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = normalizeEmail(formData.get("email"));
  if (!isValidEmail(email)) {
    return { error: "Podaj poprawny adres e-mail." };
  }

  const supabase = await createClient();
  // Link w e-mailu prowadzi do /auth/confirm (szablon supabase/templates/recovery.html).
  await supabase.auth.resetPasswordForEmail(email);
  // Ta sama odpowiedź niezależnie od tego, czy konto istnieje.
  return { success: "Jeśli konto istnieje, wysłałyśmy link do ustawienia hasła. Sprawdź skrzynkę." };
}

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = formString(formData, "password");
  const confirmation = formString(formData, "confirmation");
  const problem = validatePassword(password, confirmation);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { error: "Link wygasł. Poproś o nowy link do ustawienia hasła." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Nowe hasło musi się różnić od poprzedniego."
          : "Nie udało się ustawić hasła. Spróbuj ponownie.",
    };
  }
  redirect("/");
}
