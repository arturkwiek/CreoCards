/**
 * Przełączniki funkcji sterowane zmiennymi środowiskowymi (tylko serwer).
 *
 * AUTH_EMAILS_ENABLED – e-maile Auth (zaproszenia, reset hasła). Domyślnie wyłączone:
 * bez własnego SMTP wbudowana poczta Supabase dociera tylko do członków projektu,
 * więc zaproszenie „e-mailem” tworzyło konto, do którego nikt nie dostał linku.
 * Włączyć (`true`) dopiero po skonfigurowaniu Resend (docs/WDROZENIE-STAGING.md, sekcja 6).
 */
export function isAuthEmailEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AUTH_EMAILS_ENABLED?.trim().toLowerCase() === "true";
}
