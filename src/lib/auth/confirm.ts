import type { PasswordLinkType } from "./invite-link";

/** Typy linków, które prowadzą do ustawienia hasła. */
const PASSWORD_LINK_TYPES: readonly PasswordLinkType[] = ["invite", "recovery"];

export type ConfirmParams = { tokenHash: string; type: PasswordLinkType };

/** Parametry linku z e-maila lub od właścicielki; null, gdy link jest niekompletny. */
export function parseConfirmParams(tokenHash: unknown, type: unknown): ConfirmParams | null {
  if (typeof tokenHash !== "string" || !/^[A-Za-z0-9_-]{8,256}$/.test(tokenHash)) return null;
  if (typeof type !== "string" || !PASSWORD_LINK_TYPES.includes(type as PasswordLinkType)) return null;
  return { tokenHash, type: type as PasswordLinkType };
}
