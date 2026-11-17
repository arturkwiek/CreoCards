import { describe, expect, it } from "vitest";
import {
  accountIdentity,
  passwordSetMessage,
  isTechnicalEmail,
  isValidLogin,
  normalizeLogin,
  parseIdentifier,
  technicalEmail,
  unknownLoginEmail,
  visibleEmail,
} from "./login";
import { generateTempPassword, TEMP_PASSWORD_LENGTH } from "./temp-password";
import { validatePassword } from "@/lib/validation";

describe("login", () => {
  it("format: małe litery, cyfry, kropka, myślnik, 3–30 znaków", () => {
    expect(isValidLogin("ania")).toBe(true);
    expect(isValidLogin("ania.k-2")).toBe(true);
    expect(isValidLogin("abc")).toBe(true);
    expect(isValidLogin("a".repeat(30))).toBe(true);
    expect(isValidLogin("ab")).toBe(false);
    expect(isValidLogin("a".repeat(31))).toBe(false);
    expect(isValidLogin("Ania")).toBe(false);
    expect(isValidLogin("ania_k")).toBe(false);
    expect(isValidLogin("żaneta")).toBe(false);
    expect(normalizeLogin("  Ania.K ")).toBe("ania.k");
  });

  it("rozpoznaje login i e-mail w jednym polu", () => {
    expect(parseIdentifier(" Ania ")).toEqual({ kind: "login", login: "ania" });
    expect(parseIdentifier("Kinga@WP.pl")).toEqual({ kind: "email", email: "kinga@wp.pl" });
    expect(parseIdentifier("ab")).toBeNull();
    expect(parseIdentifier("kinga@")).toBeNull();
    expect(parseIdentifier(undefined)).toBeNull();
  });

  it("adres techniczny z fragmentem id salonu; nie pokazujemy go w UI", () => {
    const email = technicalEmail("ania", "a0000000-1234-0000-0000-00000000000a");
    expect(email).toBe("ania.a0000000@konta.creocards.studiocreotarnow.pl");
    expect(isTechnicalEmail(email)).toBe(true);
    expect(isTechnicalEmail("kinga@wp.pl")).toBe(false);
    expect(visibleEmail(email)).toBe("");
    expect(visibleEmail("kinga@wp.pl")).toBe("kinga@wp.pl");
    expect(isTechnicalEmail(unknownLoginEmail("ania"))).toBe(true);
  });
});

describe("hasło tymczasowe", () => {
  it("12 znaków bez mylących, spełnia wymagania hasła", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(p).not.toMatch(/[0O1lI]/);
      expect(validatePassword(p)).toBeNull();
    }
  });
  it("losuje aż do spełnienia warunku litera + cyfra", () => {
    // Najpierw same cyfry („2”), potem litery i cyfry na przemian.
    const bytes = [...Array(12).fill(48), ...Array.from({ length: 12 }, (_, i) => (i % 2 ? 48 : 0))];
    const p = generateTempPassword(() => bytes.shift() ?? 0);
    expect(p).toMatch(/[a-zA-Z]/);
    expect(p).toMatch(/\d/);
  });
});

describe("konto na stronie ustawiania hasła", () => {
  const tech = technicalEmail("ania", "a0000000-0000-0000-0000-00000000000a");
  it("konto z loginem: login (adres techniczny nigdy nie jest pokazywany)", () => {
    expect(accountIdentity({ login: "ania", email: tech })).toEqual({ kind: "login", value: "ania" });
    expect(passwordSetMessage({ kind: "login", value: "ania" })).toBe("Gotowe. Logujesz się loginem ania i nowym hasłem.");
  });
  it("konto bez loginu: e-mail", () => {
    expect(accountIdentity({ login: null, email: "kinga@example.com" })).toEqual({ kind: "email", value: "kinga@example.com" });
    expect(passwordSetMessage({ kind: "email", value: "kinga@example.com" })).toBe(
      "Gotowe. Logujesz się e-mailem kinga@example.com i nowym hasłem.",
    );
  });
  it("adres techniczny bez loginu nie jest ujawniany", () => {
    expect(accountIdentity({ login: null, email: tech }).value).toBe("");
  });
});
