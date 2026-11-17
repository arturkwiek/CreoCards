/**
 * Loginy (konta bez e-maila): walidacja, rozpoznanie „login lub e-mail”, adres techniczny.
 * Adres techniczny: <login>.<8 znaków id salonu>@konta.creocards.studiocreotarnow.pl – domena bez MX,
 * nic nie jest wysyłane; adresu nie pokazujemy w UI.
 */
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export const LOGIN_PATTERN = /^[a-z0-9.-]{3,30}$/;
export const TECHNICAL_EMAIL_DOMAIN = "konta.creocards.studiocreotarnow.pl";

export const LOGIN_RULES = "3–30 znaków: małe litery, cyfry, kropka lub myślnik";

export function normalizeLogin(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidLogin(login: string): boolean {
  return LOGIN_PATTERN.test(login);
}

/** Adres techniczny konta bez e-maila (salon w adresie – ten sam login w dwóch salonach się nie zderzy). */
export function technicalEmail(login: string, salonId: string): string {
  return `${login}.${salonId.replace(/-/g, "").slice(0, 8).toLowerCase()}@${TECHNICAL_EMAIL_DOMAIN}`;
}

export function isTechnicalEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${TECHNICAL_EMAIL_DOMAIN}`);
}

/** E-mail do pokazania w UI – pusty dla adresu technicznego. */
export function visibleEmail(email: string | null | undefined): string {
  return email && !isTechnicalEmail(email) ? email : "";
}

export type LoginIdentifier = { kind: "email"; email: string } | { kind: "login"; login: string };

/** Pole „Login lub e-mail”: ze znakiem „@” – e-mail, bez – login. */
export function parseIdentifier(value: unknown): LoginIdentifier | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.includes("@")) {
    const email = normalizeEmail(text);
    return isValidEmail(email) ? { kind: "email", email } : null;
  }
  const login = normalizeLogin(text);
  return isValidLogin(login) ? { kind: "login", login } : null;
}

/** Adres, na który na pewno nie ma konta – logowanie nieistniejącym loginem trwa i kończy się tak samo. */
export function unknownLoginEmail(login: string): string {
  return `${login}.00000000@${TECHNICAL_EMAIL_DOMAIN}`;
}

export type AccountIdentity = { kind: "login" | "email"; value: string };

/** Czym konto się loguje: login, a gdy go nie ma – widoczny e-mail (nigdy adres techniczny). */
export function accountIdentity(user: { login: string | null; email: string }): AccountIdentity {
  if (user.login) return { kind: "login", value: user.login };
  return { kind: "email", value: visibleEmail(user.email) };
}

/** Potwierdzenie po zapisaniu hasła. */
export function passwordSetMessage(identity: AccountIdentity): string {
  return identity.kind === "login"
    ? `Gotowe. Logujesz się loginem ${identity.value} i nowym hasłem.`
    : `Gotowe. Logujesz się e-mailem ${identity.value} i nowym hasłem.`;
}
