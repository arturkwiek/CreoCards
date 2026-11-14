import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail, parseRole, validatePassword } from "./validation";

describe("normalizeEmail / isValidEmail", () => {
  it("przycina i zamienia na małe litery", () => {
    expect(normalizeEmail("  Anna@Creo.PL ")).toBe("anna@creo.pl");
  });
  it("odrzuca nie-stringi", () => {
    expect(normalizeEmail(null)).toBe("");
  });
  it("waliduje adres", () => {
    expect(isValidEmail("anna@creo.pl")).toBe(true);
    expect(isValidEmail("anna@creo")).toBe(false);
    expect(isValidEmail("anna creo@x.pl")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("wymaga min. 8 znaków", () => {
    expect(validatePassword("abc123")).toMatch(/8 znaków/);
  });
  it("wymaga litery i cyfry", () => {
    expect(validatePassword("abcdefgh")).toMatch(/literę i cyfrę/);
    expect(validatePassword("12345678")).toMatch(/literę i cyfrę/);
  });
  it("akceptuje polskie litery", () => {
    expect(validatePassword("żółwik123")).toBeNull();
  });
  it("sprawdza powtórzenie", () => {
    expect(validatePassword("haslo1234", "haslo1235")).toMatch(/takie same/);
    expect(validatePassword("haslo1234", "haslo1234")).toBeNull();
  });
});

describe("parseRole", () => {
  it("przyjmuje tylko znane role", () => {
    expect(parseRole("owner")).toBe("owner");
    expect(parseRole("apprentice")).toBe("apprentice");
    expect(parseRole("admin")).toBeNull();
  });
});
