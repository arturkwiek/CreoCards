export const LOGIN_PATH = "/logowanie";
export const SET_PASSWORD_PATH = "/ustaw-haslo";

/** Ścieżki dostępne bez zalogowania. */
const PUBLIC_PATHS = [LOGIN_PATH, "/zapomniane-haslo", "/auth/confirm"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Gdzie przekierować żądanie (null = przepuść) na podstawie stanu sesji. */
export function authRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (!isAuthenticated && !isPublicPath(pathname)) return LOGIN_PATH;
  if (isAuthenticated && pathname === LOGIN_PATH) return "/";
  return null;
}
