import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, phoneDigits, telHref } from "./phone";

describe("normalizePhone", () => {
  it("polski numer w różnych zapisach → +48…", () => {
    for (const input of ["600123456", "600 123 456", "600-123-456", "+48 600 123 456", "0048600123456", " (600) 123 456 "]) {
      expect(normalizePhone(input)).toBe("+48600123456");
    }
  });

  it("numer zagraniczny z + zostaje bez zmian", () => {
    expect(normalizePhone("+49 151 2345 6789")).toBe("+4915123456789");
  });

  it("9 cyfr (także stacjonarny z numerem kierunkowym) → +48…", () => {
    expect(normalizePhone("14 621 00 00")).toBe("+48146210000");
  });

  it("inna liczba cyfr bez + zostaje jako same cyfry", () => {
    expect(normalizePhone("1234567")).toBe("1234567");
  });

  it("odrzuca za krótkie, za długie i puste", () => {
    for (const input of ["", "   ", "12345", "+1234567890123456", null, undefined, 600123456]) {
      expect(normalizePhone(input)).toBeNull();
    }
  });
});

describe("formatPhone / telHref / phoneDigits", () => {
  it("polski numer bez kierunkowego, w grupach po 3", () => {
    expect(formatPhone("+48600123456")).toBe("600 123 456");
  });

  it("inne numery bez zmian", () => {
    expect(formatPhone("+4915123456789")).toBe("+4915123456789");
    expect(formatPhone("1234567")).toBe("1234567");
  });

  it("link tel: bez spacji", () => {
    expect(telHref("+48600123456")).toBe("tel:+48600123456");
    expect(telHref("1234567")).toBe("tel:1234567");
  });

  it("same cyfry", () => {
    expect(phoneDigits("+48 600-123 456")).toBe("48600123456");
  });
});
