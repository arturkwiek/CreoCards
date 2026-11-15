import { describe, expect, it } from "vitest";
import {
  compareShades,
  effectiveRatio,
  formatPrice,
  formatRatio,
  parsePackageSize,
  parsePrice,
  parseProductType,
  parseRatio,
  shadeKey,
} from "./values";

describe("parseProductType", () => {
  it("rozpoznaje typy bez względu na wielkość liter i polskie znaki", () => {
    expect(parseProductType("Farba")).toBe("farba");
    expect(parseProductType("UTLENIACZ")).toBe("utleniacz");
    expect(parseProductType("Rozjaśniacz")).toBe("rozjasniacz");
    expect(parseProductType("rozjasniacz")).toBe("rozjasniacz");
    expect(parseProductType(" toner ")).toBe("toner");
    expect(parseProductType("Inny")).toBe("inny");
    expect(parseProductType("inne")).toBe("inny");
  });
  it("odrzuca nieznane typy", () => {
    expect(parseProductType("szampon")).toBeNull();
    expect(parseProductType("")).toBeNull();
  });
});

describe("parseRatio", () => {
  it("czyta proporcje z dwukropkiem, przecinkiem, kropką i plusem", () => {
    expect(parseRatio("1:1.5")).toBe(1.5);
    expect(parseRatio("1:1,5")).toBe(1.5);
    expect(parseRatio("1 : 2")).toBe(2);
    expect(parseRatio("1+1,5")).toBe(1.5);
    expect(parseRatio("1:1")).toBe(1);
    expect(parseRatio("2:3")).toBe(1.5);
    expect(parseRatio("1,5")).toBe(1.5);
  });
  it("puste i „inna (w uwagach)” = brak proporcji", () => {
    expect(parseRatio("")).toBeNull();
    expect(parseRatio("  ")).toBeNull();
    expect(parseRatio("inna (w uwagach)")).toBeNull();
    expect(parseRatio("Inna")).toBeNull();
  });
  it("odrzuca błędne wartości", () => {
    expect(parseRatio("pół na pół")).toBe("invalid");
    expect(parseRatio("1:0")).toBe("invalid");
    expect(parseRatio("1:20")).toBe("invalid");
    expect(parseRatio("0:1")).toBe("invalid");
  });
});

describe("formatRatio / formatPrice", () => {
  it("formatuje po polsku", () => {
    expect(formatRatio(1.5)).toBe("1:1,5");
    expect(formatRatio(2)).toBe("1:2");
    expect(formatRatio(null)).toBe("");
    expect(formatPrice(21.5)).toBe("21,50 zł");
  });
  it("proporcja produktu nadpisuje domyślną linii", () => {
    expect(effectiveRatio(2, 1.5)).toBe(2);
    expect(effectiveRatio(null, 1.5)).toBe(1.5);
    expect(effectiveRatio(null, null)).toBeNull();
  });
});

describe("pojemność i cena", () => {
  it("pojemność w g lub ml, z przecinkiem", () => {
    expect(parsePackageSize("60")).toBe(60);
    expect(parsePackageSize("60 g")).toBe(60);
    expect(parsePackageSize("1000ml")).toBe(1000);
    expect(parsePackageSize("62,5")).toBe(62.5);
    expect(parsePackageSize("")).toBeNull();
    expect(parsePackageSize("0")).toBe("invalid");
    expect(parsePackageSize("dużo")).toBe("invalid");
  });
  it("cena w zł, z przecinkiem", () => {
    expect(parsePrice("21,50")).toBe(21.5);
    expect(parsePrice("21,50 zł")).toBe(21.5);
    expect(parsePrice("19.9 PLN")).toBe(19.9);
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("-5")).toBe("invalid");
  });
});

describe("odcienie", () => {
  it("„7,1”, „7/1” i „7.1” mają ten sam klucz", () => {
    expect(shadeKey("7,1")).toBe("7.1");
    expect(shadeKey("7/1")).toBe("7.1");
    expect(shadeKey(" 7.1 ")).toBe("7.1");
    expect(shadeKey("6 %")).toBe("6%");
  });
  it("sortowanie naturalne", () => {
    const shades = ["10.1", "7.11", "6.0", "7.1", "12%", "3%", "9%", "8.3"];
    expect([...shades].sort(compareShades)).toEqual(["3%", "6.0", "7.1", "7.11", "8.3", "9%", "10.1", "12%"]);
  });
});
