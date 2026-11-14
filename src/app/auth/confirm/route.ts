import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SET_PASSWORD_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/** Typy linków z e-maili, które prowadzą do ustawienia hasła. */
const PASSWORD_LINK_TYPES: EmailOtpType[] = ["invite", "recovery"];

/**
 * Weryfikacja linku z e-maila (zaproszenie, reset hasła) – token_hash z szablonów
 * w supabase/templates. Po sukcesie: sesja + przejście do ustawienia hasła.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && PASSWORD_LINK_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(SET_PASSWORD_PATH, request.url));
    }
  }

  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set("blad", "link");
  return NextResponse.redirect(url);
}
