import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatPriceRange,
  parseDuration,
  parsePriceRange,
  parseServicesCsv,
  parseYesNo,
  planServices,
  serviceHeaderField,
} from "./import";

// Wyłącznie dane testowe.
const readDoc = (name: string) => readFileSync(new URL(`../../../docs/${name}`, import.meta.url), "utf8");

describe("wartości usług", () => {
  it("czas w minutach w różnych zapisach", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("90 min")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1,5 h")).toBe(90);
    expect(parseDuration("1 h 30 min")).toBe(90);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("długo")).toBe("invalid");
    expect(parseDuration("0")).toBe("invalid");
  });

  it("cena od–do w jednej kolumnie", () => {
    expect(parsePriceRange("100–150")).toEqual({ from: 100, to: 150 });
    expect(parsePriceRange("100 - 150 zł")).toEqual({ from: 100, to: 150 });
    expect(parsePriceRange("od 80 zł")).toEqual({ from: 80, to: null });
    expect(parsePriceRange("120")).toEqual({ from: 120, to: 120 });
    expect(parsePriceRange("99,50")).toEqual({ from: 99.5, to: 99.5 });
    expect(parsePriceRange("")).toEqual({ from: null, to: null });
    expect(parsePriceRange("150–100")).toBe("invalid");
    expect(parsePriceRange("dużo")).toBe("invalid");
  });

  it("„Z farbą?”: TRUE/FALSE z arkusza i tak/nie", () => {
    expect(parseYesNo("TRUE")).toBe(true);
    expect(parseYesNo("FALSE")).toBe(false);
    expect(parseYesNo("tak")).toBe(true);
    expect(parseYesNo("Nie")).toBe(false);
    expect(parseYesNo("x")).toBe(true);
    expect(parseYesNo("")).toBeNull();
    expect(parseYesNo("może")).toBe("invalid");
  });

  it("formatowanie", () => {
    expect(formatPriceRange(150, 250)).toBe("150–250 zł");
    expect(formatPriceRange(80, null)).toBe("od 80 zł");
    expect(formatPriceRange(120, 120)).toBe("120 zł");
    expect(formatPriceRange(null, null)).toBe("");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(120)).toBe("2 h");
  });
});

describe("serviceHeaderField", () => {
  it("nagłówki zakładki „Usługi” i warianty", () => {
    expect(serviceHeaderField("Usługa")).toBe("name");
    expect(serviceHeaderField("Cena od (zł)")).toBe("price_from");
    expect(serviceHeaderField("Cena do (zł)")).toBe("price_to");
    expect(serviceHeaderField("Cena od–do (zł)")).toBe("price_range");
    expect(serviceHeaderField("Cena")).toBe("price_range");
    expect(serviceHeaderField("Czas (min)")).toBe("duration_min");
    expect(serviceHeaderField("Z farbą?")).toBe("with_color");
    expect(serviceHeaderField("Uwagi")).toBe("ignore");
    expect(serviceHeaderField("Kategoria")).toBeNull();
  });
});

describe("parseServicesCsv", () => {
  it("docs/uslugi-przyklad.csv: 5 usług, „Uwagi” pominięte", () => {
    const result = parseServicesCsv(readDoc("uslugi-przyklad.csv"));
    expect(result.fatal).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.items).toEqual([
      { name: "Strzyżenie damskie", price_from: 80, price_to: 120, duration_min: 45, with_color: false },
      { name: "Koloryzacja odrostu", price_from: 150, price_to: 200, duration_min: 90, with_color: true },
      { name: "Koloryzacja całość", price_from: 180, price_to: 260, duration_min: 120, with_color: true },
      { name: "Tonowanie", price_from: 90, duration_min: 40, with_color: true },
      { name: "Modelowanie", price_from: 60, price_to: 80, duration_min: 30, with_color: false },
    ]);
  });

  it("wariant: jedna kolumna ceny, czas „1:30”, „tak/nie”, średnik", () => {
    const result = parseServicesCsv("Nazwa;Cena;Czas;Z farbą?\nBalayage;300–450;3 h;tak\nGrzywka;20;15 min;nie");
    expect(result.items).toEqual([
      { name: "Balayage", price_from: 300, price_to: 450, duration_min: 180, with_color: true },
      { name: "Grzywka", price_from: 20, price_to: 20, duration_min: 15, with_color: false },
    ]);
  });

  it("błędy z numerem wiersza i brak kolumny „Usługa”", () => {
    expect(parseServicesCsv("Cena\n100").fatal).toBe("Brak wymaganej kolumny: Usługa.");
    const result = parseServicesCsv("Usługa,Cena od (zł),Cena do (zł),Czas (min),Z farbą?\n,10,,,\nA,200,100,,\nB,,,długo,może");
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, message: "brak nazwy usługi" },
      { row: 3, message: "cena do niższa niż cena od" },
      { row: 4, message: "nieprawidłowy czas (np. 90 albo 1:30), „Z farbą?” – tak/nie (TRUE/FALSE)" },
    ]);
  });

  it("podgląd: nowe, zmienione i bez zmian", () => {
    const { items } = parseServicesCsv(readDoc("uslugi-przyklad.csv"));
    const plan = planServices(items, [
      { name: "strzyżenie damskie", price_from: 80, price_to: 120, duration_min: 45, with_color: false },
      { name: "Tonowanie", price_from: 90, price_to: 120, duration_min: 30, with_color: true },
    ]);
    expect(plan).toEqual({
      created: ["Koloryzacja odrostu", "Koloryzacja całość", "Modelowanie"],
      updated: ["Tonowanie"],
      unchanged: 1,
    });
  });
});
