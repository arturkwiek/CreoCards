import { describe, expect, it } from "vitest";
import { isAuthEmailEnabled } from "./features";

describe("isAuthEmailEnabled", () => {
  it("domyślnie wyłączone (brak zmiennej)", () => {
    expect(isAuthEmailEnabled({})).toBe(false);
  });

  it("włączone tylko dla wartości true", () => {
    expect(isAuthEmailEnabled({ AUTH_EMAILS_ENABLED: "true" })).toBe(true);
    expect(isAuthEmailEnabled({ AUTH_EMAILS_ENABLED: " TRUE " })).toBe(true);
  });

  it("inne wartości nie włączają e-maili", () => {
    for (const value of ["", "false", "0", "1", "yes", "tak"]) {
      expect(isAuthEmailEnabled({ AUTH_EMAILS_ENABLED: value })).toBe(false);
    }
  });
});
