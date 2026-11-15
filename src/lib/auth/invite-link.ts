/** Typy jednorazowych linków prowadzących do ustawienia hasła. */
export type PasswordLinkType = "invite" | "recovery";

/**
 * Link prowadzący do /auth/confirm (ten sam format co w szablonach e-maili).
 * hashedToken pochodzi z auth.admin.generateLink({ type }).
 */
export function buildAuthLink(origin: string, hashedToken: string, type: PasswordLinkType): string {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", type);
  return url.toString();
}

export function buildInviteLink(origin: string, hashedToken: string): string {
  return buildAuthLink(origin, hashedToken, "invite");
}
