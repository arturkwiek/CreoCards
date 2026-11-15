"use server";

import { redirect } from "next/navigation";
import { parseConfirmParams } from "@/lib/auth/confirm";
import { LOGIN_PATH, SET_PASSWORD_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";

/**
 * Zużycie jednorazowego tokenu dopiero po kliknięciu „Kontynuuj” (POST).
 * GET linku (podgląd w SMS/WhatsApp, skaner poczty) niczego nie zużywa.
 */
export async function confirmLink(formData: FormData): Promise<void> {
  const params = parseConfirmParams(formString(formData, "token_hash"), formString(formData, "type"));
  if (params) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: params.type, token_hash: params.tokenHash });
    if (!error) redirect(SET_PASSWORD_PATH);
  }
  redirect(`${LOGIN_PATH}?blad=link`);
}
