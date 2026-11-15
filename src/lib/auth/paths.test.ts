import { describe, expect, it } from "vitest";
import { authRedirect, isPublicPath, mustChangePassword } from "./paths";

describe("isPublicPath", () => {
  it("rozpoznaje ścieżki publiczne", () => {
    expect(isPublicPath("/logowanie")).toBe(true);
    expect(isPublicPath("/zapomniane-haslo")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });
  it("nie traktuje prefiksów jako publicznych", () => {
    expect(isPublicPath("/logowanie-x")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/zespol")).toBe(false);
    expect(isPublicPath("/ustaw-haslo")).toBe(false);
  });
});

describe("authRedirect", () => {
  it("niezalogowana osoba trafia na logowanie", () => {
    expect(authRedirect("/", false)).toBe("/logowanie");
    expect(authRedirect("/zespol", false)).toBe("/logowanie");
    expect(authRedirect("/ustaw-haslo", false)).toBe("/logowanie");
  });
  it("strony publiczne bez przekierowania", () => {
    expect(authRedirect("/logowanie", false)).toBeNull();
    expect(authRedirect("/auth/confirm", false)).toBeNull();
  });
  it("zalogowana osoba nie widzi ekranu logowania", () => {
    expect(authRedirect("/logowanie", true)).toBe("/");
    expect(authRedirect("/zespol", true)).toBeNull();
  });
});

describe("hasło tymczasowe", () => {
  it("wymusza zmianę hasła – dostępny tylko ekran ustawienia hasła", () => {
    expect(authRedirect("/", true, true)).toBe("/ustaw-haslo");
    expect(authRedirect("/zespol", true, true)).toBe("/ustaw-haslo");
    expect(authRedirect("/logowanie", true, true)).toBe("/ustaw-haslo");
    expect(authRedirect("/ustaw-haslo", true, true)).toBeNull();
  });
  it("flaga tylko z app_metadata.must_change_password === true", () => {
    expect(mustChangePassword({ must_change_password: true })).toBe(true);
    expect(mustChangePassword({ must_change_password: false })).toBe(false);
    expect(mustChangePassword({ must_change_password: "true" })).toBe(false);
    expect(mustChangePassword(undefined)).toBe(false);
  });
});
