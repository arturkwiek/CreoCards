import { describe, expect, it } from "vitest";
import { formatVisitDate, fromWarsawLocal, toWarsawLocal } from "./time";

describe("czas wizyty w strefie Europe/Warsaw", () => {
  it("zima (UTC+1) i lato (UTC+2)", () => {
    expect(toWarsawLocal("2026-01-15T09:30:00Z")).toBe("2026-01-15T10:30");
    expect(toWarsawLocal("2026-07-15T09:30:00Z")).toBe("2026-07-15T11:30");
    expect(fromWarsawLocal("2026-01-15T10:30")?.toISOString()).toBe("2026-01-15T09:30:00.000Z");
    expect(fromWarsawLocal("2026-07-15T11:30")?.toISOString()).toBe("2026-07-15T09:30:00.000Z");
  });

  it("w obie strony bez zmian, także w dniu zmiany czasu", () => {
    for (const local of ["2026-03-29T01:30", "2026-03-29T04:00", "2026-10-25T04:00", "2025-12-31T23:59"]) {
      expect(toWarsawLocal(fromWarsawLocal(local)!)).toBe(local);
    }
  });

  it("sama data (receptura z zeszytu) = południe tego dnia", () => {
    expect(toWarsawLocal(fromWarsawLocal("2024-05-10")!)).toBe("2024-05-10T12:00");
  });

  it("błędne wartości", () => {
    expect(fromWarsawLocal("")).toBeNull();
    expect(fromWarsawLocal("2026-02-30")).toBeNull();
    expect(fromWarsawLocal("2026-01-01T25:00")).toBeNull();
    expect(fromWarsawLocal("wczoraj")).toBeNull();
  });

  it("format po polsku", () => {
    expect(formatVisitDate("2026-01-15T09:30:00Z")).toBe("15 stycznia 2026");
    expect(formatVisitDate("2026-01-15T09:30:00Z", true)).toBe("15 stycznia 2026 10:30");
  });
});
