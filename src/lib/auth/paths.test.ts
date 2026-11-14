import { describe, expect, it } from "vitest";
import { authRedirect, isPublicPath } from "./paths";

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
