export const LOGIN_PATH = "/logowanie";
export const SET_PASSWORD_PATH = "/ustaw-haslo";

/** Ścieżki dostępne bez zalogowania. */
const PUBLIC_PATHS = [LOGIN_PATH, "/zapomniane-haslo", "/auth/confirm"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Czy konto ma hasło tymczasowe do zmiany (flaga w app_metadata – ustawia tylko admin API). */
export function mustChangePassword(appMetadata: unknown): boolean {
  return (
    typeof appMetadata === "object" &&
    appMetadata !== null &&
    (appMetadata as Record<string, unknown>).must_change_password === true
  );
}

/**
 * Gdzie przekierować żądanie (null = przepuść) na podstawie stanu sesji.
 * Z hasłem tymczasowym dostępna jest tylko zmiana hasła.
 */
export function authRedirect(pathname: string, isAuthenticated: boolean, mustChange = false): string | null {
  if (!isAuthenticated && !isPublicPath(pathname)) return LOGIN_PATH;
  if (isAuthenticated && mustChange && pathname !== SET_PASSWORD_PATH) return SET_PASSWORD_PATH;
  if (isAuthenticated && pathname === LOGIN_PATH) return "/";
  return null;
}
