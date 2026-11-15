import { buildAuthLink, type PasswordLinkType } from "./invite-link";

/** Minimalny kształt odpowiedzi auth.admin.generateLink, potrzebny do zbudowania linku. */
export type GenerateLinkResult = {
  data: { properties?: { hashed_token?: string } | null } | null;
  error: { code?: string } | null;
};

export type GenerateLink = (type: PasswordLinkType, email: string) => Promise<GenerateLinkResult>;

export type AuthLinkResult = { link: string; error?: undefined } | { link?: undefined; error: string };

export const EMAIL_EXISTS_MESSAGE = "Ten adres ma już konto w CreoCards (np. w innym salonie).";

const FAILURE_MESSAGES: Record<PasswordLinkType, string> = {
  invite: "Nie udało się utworzyć linku zaproszenia.",
  recovery: "Nie udało się utworzyć linku do ustawienia hasła.",
};

/**
 * Jednorazowy link (zaproszenie albo ustawienie hasła) bez wysyłania e-maila.
 * Każdy nowy link unieważnia poprzedni. Token nie trafia do komunikatów błędów ani logów.
 * Wywoływać tylko po requireOwner().
 */
export async function createAuthLink(
  generate: GenerateLink,
  origin: string,
  email: string,
  type: PasswordLinkType,
): Promise<AuthLinkResult> {
  const { data, error } = await generate(type, email);
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    if (type === "invite" && error?.code === "email_exists") return { error: EMAIL_EXISTS_MESSAGE };
    return { error: FAILURE_MESSAGES[type] };
  }
  return { link: buildAuthLink(origin, token, type) };
}
