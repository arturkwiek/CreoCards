/**
 * Link zaproszenia prowadzący do /auth/confirm (ten sam format co w szablonie e-maila).
 * hashedToken pochodzi z auth.admin.generateLink({ type: "invite" }).
 */
export function buildInviteLink(origin: string, hashedToken: string): string {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "invite");
  return url.toString();
}
