import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headerField, parseImport, planImport, type ExistingLine, type ExistingProduct } from "./import";

// Wyłącznie dane testowe (pliki przykładowe z docs/).
const readDoc = (name: string) => readFileSync(new URL(`../../../docs/${name}`, import.meta.url), "utf8");

describe("headerField", () => {
  it("rozpoznaje nagłówki z pliku przykładowego i polskie z arkusza", () => {
    expect(headerField("marka")).toBe("brand");
    expect(headerField("Marka")).toBe("brand");
    expect(headerField("linia")).toBe("line");
    expect(headerField("odcien")).toBe("shade");
    expect(headerField("Odcień / stężenie")).toBe("shade");
    expect(headerField("typ")).toBe("type");
    expect(headerField("pojemnosc_g")).toBe("package_size");
    expect(headerField("Pojemność opakowania (g/ml)")).toBe("package_size");
    expect(headerField("cena_zakupu_pln")).toBe("purchase_price");
    expect(headerField("Cena zakupu (zł)")).toBe("purchase_price");
    expect(headerField("domyslna_proporcja")).toBe("ratio");
    expect(headerField("Domyślna proporcja")).toBe("ratio");
  });
  it("pomija kolumnę „Uwagi”, nieznane zwraca jako null", () => {
    expect(headerField("Uwagi")).toBe("ignore");
    expect(headerField("Kolor opakowania")).toBeNull();
  });
});

describe("parseImport – docs/katalog-przyklad.csv", () => {
  const result = parseImport(readDoc("katalog-przyklad.csv"));

  it("8 produktów w 2 liniach, bez błędów", () => {
    expect(result.fatal).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.items).toHaveLength(8);
    expect(new Set(result.items.map((i) => i.line))).toEqual(new Set(["Linia Classic", "Oxyd"]));
  });

  it("proporcja 1:1.5 trafia do linii, nie do produktów; utleniacz bez proporcji", () => {
    const shade71 = result.items.find((i) => i.shade === "7.1");
    expect(shade71).toMatchObject({ brand: "Marka A", type: "farba", package_size: 60, line_ratio: 1.5, ratio: null });
    expect(shade71).not.toHaveProperty("purchase_price");
    const oxidant = result.items.find((i) => i.shade === "6%");
    expect(oxidant).toMatchObject({ type: "utleniacz", package_size: 1000 });
    expect(oxidant).not.toHaveProperty("line_ratio");
    expect(oxidant).not.toHaveProperty("ratio");
  });
});

describe("parseImport – arkusz z polskimi nagłówkami (docs/katalog-przyklad-arkusz.csv)", () => {
  const result = parseImport(readDoc("katalog-przyklad-arkusz.csv"));
  const item = (shade: string) => result.items.find((i) => i.shade === shade);

  it("kolumny w innej kolejności, „Uwagi” pominięte, 9 produktów", () => {
    expect(result.fatal).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.items).toHaveLength(9);
  });

  it("typy: farba, utleniacz, rozjaśniacz, toner, inny", () => {
    expect(item("6.0")?.type).toBe("farba");
    expect(item("9%")?.type).toBe("utleniacz");
    expect(item("Proszek")?.type).toBe("rozjasniacz");
    expect(item("9.12")?.type).toBe("toner");
    expect(item("Krok 1")?.type).toBe("inny");
  });

  it("cena z przecinkiem, pojemność g/ml", () => {
    expect(item("7,1")).toMatchObject({ purchase_price: 21.5, package_size: 60 });
    expect(item("Proszek")).toMatchObject({ purchase_price: 89, package_size: 500 });
    expect(item("8.3")).not.toHaveProperty("purchase_price");
  });

  it("najczęstsza proporcja = domyślna linii, inna = własna produktu", () => {
    expect(item("6.0")).toMatchObject({ line_ratio: 1.5, ratio: null });
    expect(item("7.11")).toMatchObject({ line_ratio: 1.5, ratio: 2 });
    expect(item("Proszek")).toMatchObject({ line_ratio: 2, ratio: null });
  });

  it("„inna (w uwagach)” = brak proporcji", () => {
    expect(item("Krok 1")).not.toHaveProperty("line_ratio");
    expect(item("Krok 1")).not.toHaveProperty("ratio");
  });
});

describe("parseImport – błędy i ostrzeżenia", () => {
  it("brak wymaganych kolumn", () => {
    expect(parseImport("Marka,Linia\nA,B").fatal).toBe("Brak wymaganych kolumn: Odcień / stężenie, Typ.");
    expect(parseImport("").fatal).toBe("Plik jest pusty.");
  });

  it("błędy z numerem wiersza, poprawne wiersze zostają", () => {
    const result = parseImport(
      ["Marka;Odcień;Typ;Cena", "A;7.1;farba;21,50", ";8.0;farba;", "A;9.0;szampon;", "A;10.0;farba;dużo"].join("\n"),
    );
    expect(result.items).toHaveLength(1);
    expect(result.errors).toEqual([
      { row: 3, message: "brak marki" },
      { row: 4, message: "nieznany typ „szampon” (farba, utleniacz, rozjaśniacz, toner, inny)" },
      { row: 5, message: "nieprawidłowa cena" },
    ]);
  });

  it("powtórzony odcień (także „7,1” = „7.1”) – ostrzeżenie, użyty ostatni wiersz", () => {
    const result = parseImport("marka,linia,odcien,typ,cena_zakupu_pln\nA,L,7.1,farba,10\na,l,\"7,1\",farba,12\n");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].purchase_price).toBe(12);
    expect(result.warnings).toEqual(["Wiersz 3 powtarza wiersz 2 (a l 7,1) – użyto wiersza 3."]);
  });

  it("nieznane kolumny – ostrzeżenie", () => {
    const result = parseImport("Marka,Odcień,Typ,Kod EAN\nA,7.1,farba,123");
    expect(result.warnings).toEqual(["Pominięto nieznane kolumny: Kod EAN."]);
  });
});

describe("planImport", () => {
  const { items } = parseImport(readDoc("katalog-przyklad.csv"));

  it("pusty katalog: 2 nowe linie, 8 nowych produktów", () => {
    expect(planImport(items, [], [])).toEqual({
      newLines: ["Marka A Linia Classic (proporcja 1:1,5)", "Marka A Oxyd"],
      updatedLines: [],
      newProducts: 8,
      updatedProducts: 0,
      unchangedProducts: 0,
    });
  });

  it("ponowny import tego samego pliku nic nie zmienia", () => {
    const lines: ExistingLine[] = [
      { brand: "Marka A", name: "Linia Classic", default_ratio: 1.5 },
      { brand: "Marka A", name: "Oxyd", default_ratio: null },
    ];
    const products: ExistingProduct[] = items.map((i) => ({
      brand: i.brand,
      line: i.line,
      shade: i.shade,
      type: i.type,
      package_size: i.package_size ?? null,
      purchase_price: null,
      ratio: null,
    }));
    expect(planImport(items, lines, products)).toEqual({
      newLines: [],
      updatedLines: [],
      newProducts: 0,
      updatedProducts: 0,
      unchangedProducts: 8,
    });
  });

  it("wypełnione pola aktualizują, puste nie nadpisują", () => {
    const lines: ExistingLine[] = [{ brand: "marka a", name: "linia classic", default_ratio: 2 }];
    const products: ExistingProduct[] = [
      { brand: "Marka A", line: "Linia Classic", shade: "7/1", type: "farba", package_size: 50, purchase_price: 20, ratio: null },
    ];
    const plan = planImport(items, lines, products);
    expect(plan.updatedLines).toEqual(["marka a linia classic (proporcja 1:1,5)"]);
    expect(plan.newLines).toEqual(["Marka A Oxyd"]);
    expect(plan.updatedProducts).toBe(1); // 7.1: pojemność 50 → 60, cena zostaje
    expect(plan.newProducts).toBe(7);
  });
});
