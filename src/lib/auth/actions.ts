"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthEmailEnabled } from "@/lib/features";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  formString,
  isValidEmail,
  normalizeEmail,
  validatePassword,
} from "@/lib/validation";
import { parseIdentifier, unknownLoginEmail } from "./login";
import { LOGIN_PATH, SET_PASSWORD_PATH, mustChangePassword } from "./paths";
import { THROTTLED_MESSAGE, attemptKeys, clientIp, isThrottled, recordAttempt } from "./rate-limit";

export type FormState = { error?: string; success?: string };

const SIGN_IN_ERROR = "Nieprawidłowy login/e-mail lub hasło.";

/** Login → adres konta (zapytanie kluczem service role, nic nie trafia do przeglądarki). */
async function emailForLogin(login: string): Promise<string> {
  const { data } = await createAdminClient().from("users").select("email").eq("login", login).limit(2);
  // Brak konta albo (w przyszłości) ten sam login w dwóch salonach – adres bez konta, ten sam komunikat.
  return data?.length === 1 ? data[0].email : unknownLoginEmail(login);
}

/**
 * Logowanie „login lub e-mail” + hasło. Komunikat błędu zawsze ten sam (nie zdradza, czy konto istnieje).
 * Limit nieudanych prób na login i IP (login_attempts). Hasło tymczasowe → wymuszona zmiana.
 */
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = parseIdentifier(formData.get("identifier") ?? formData.get("email"));
  const password = formString(formData, "password");
  if (!identifier || !password) {
    return { error: "Podaj login lub e-mail i hasło." };
  }

  const key = identifier.kind === "email" ? identifier.email : identifier.login;
  const keys = attemptKeys(key, clientIp(await headers()));
  if (await isThrottled(keys)) return { error: THROTTLED_MESSAGE };

  const email = identifier.kind === "email" ? identifier.email : await emailForLogin(identifier.login);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  await recordAttempt(keys, !error);
  if (error) {
    return { error: SIGN_IN_ERROR };
  }
  redirect(mustChangePassword(data.user?.app_metadata) ? SET_PASSWORD_PATH : "/");
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

  if (!isAuthEmailEnabled()) {
    return { error: "Wysyłka e-maili jest wyłączona. Poproś właścicielkę salonu o link do ustawienia hasła." };
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

  const { data: updated, error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Nowe hasło musi się różnić od poprzedniego."
          : "Nie udało się ustawić hasła. Spróbuj ponownie.",
    };
  }
  // Hasło tymczasowe zmienione – zdejmujemy wymuszenie (app_metadata zmienia tylko admin API) i odświeżamy sesję.
  if (updated.user && mustChangePassword(updated.user.app_metadata)) {
    await createAdminClient().auth.admin.updateUserById(updated.user.id, {
      app_metadata: { must_change_password: false },
    });
    await supabase.auth.refreshSession();
  }
  redirect("/");
}
