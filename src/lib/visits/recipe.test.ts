import { describe, expect, it } from "vitest";
import {
  byUsage,
  copyRecipe,
  findOxidant,
  mixSummary,
  oxidantGrams,
  parseRecipe,
  suggestRatio,
  type DraftMix,
} from "./recipe";

// Wyłącznie dane testowe.
const P1 = "e1000000-0000-0000-0000-0000000000a1";
const P2 = "e1000000-0000-0000-0000-0000000000a2";
const OX = "e1000000-0000-0000-0000-0000000000a3";
const ids = new Set([P1, P2, OX]);

const mix = (over: Partial<DraftMix> = {}): DraftMix => ({
  zone: "odrost",
  oxidant_percent: 6,
  ratio: 1.5,
  processing_minutes: 35,
  items: [
    { product_id: P1, grams: 30 },
    { product_id: P2, grams: 15 },
  ],
  ...over,
});

describe("oxidantGrams", () => {
  it("suma farb × proporcja", () => {
    expect(oxidantGrams(mix())).toBe(67.5);
    expect(oxidantGrams(mix({ ratio: 2 }))).toBe(90);
    expect(oxidantGrams(mix({ ratio: 1, items: [{ product_id: P1, grams: 60 }] }))).toBe(60);
  });
  it("bez utleniacza = 0 g", () => {
    expect(oxidantGrams(mix({ oxidant_percent: null, ratio: null }))).toBe(0);
  });
});

describe("suggestRatio", () => {
  const products = new Map([
    [P1, { id: P1, ratio: null, line_ratio: 1.5 }],
    [P2, { id: P2, ratio: 2, line_ratio: 1.5 }],
  ]);
  it("z pierwszego produktu: własna proporcja albo domyślna linii", () => {
    expect(suggestRatio(mix().items, products)).toBe(1.5);
    expect(suggestRatio([{ product_id: P2, grams: 30 }, { product_id: P1, grams: 30 }], products)).toBe(2);
    expect(suggestRatio([], products)).toBeNull();
  });
});

describe("findOxidant", () => {
  const catalog = [
    { id: "a", brand: "Marka A", shade: "6%", type: "utleniacz" },
    { id: "b", brand: "Marka A", shade: "9 %", type: "utleniacz" },
    { id: "c", brand: "Marka B", shade: "6%", type: "utleniacz" },
    { id: "d", brand: "Marka A", shade: "6.0", type: "farba" },
  ];
  it("ta sama marka i stężenie", () => {
    expect(findOxidant(catalog, "marka a", 6)).toBe("a");
    expect(findOxidant(catalog, "Marka A", 9)).toBe("b");
    expect(findOxidant(catalog, "Marka B", 6)).toBe("c");
  });
  it("brak dopasowania", () => {
    expect(findOxidant(catalog, "Marka A", 12)).toBeNull();
    expect(findOxidant(catalog, "Marka C", 6)).toBeNull();
    expect(findOxidant(catalog, "Marka A", null)).toBeNull();
  });
});

describe("parseRecipe", () => {
  it("poprawna receptura; mieszanki bez farb pomijane", () => {
    const json = JSON.stringify({ note: " Test ", mixes: [mix(), mix({ items: [] }), mix({ zone: "dlugosci", oxidant_percent: null, ratio: 2 })] });
    expect(parseRecipe(json, ids)).toEqual({
      recipe: { note: "Test", mixes: [mix(), mix({ zone: "dlugosci", oxidant_percent: null, ratio: null })] },
    });
  });
  it("pusta receptura", () => {
    expect(parseRecipe("", ids)).toEqual({ recipe: { note: "", mixes: [] } });
  });
  it("błędy z numerem mieszanki", () => {
    expect(parseRecipe(JSON.stringify({ mixes: [mix({ ratio: null })] }), ids).error).toBe(
      "Mieszanka 1: wybierz proporcję utleniacza.",
    );
    expect(parseRecipe(JSON.stringify({ mixes: [mix(), mix({ items: [{ product_id: "x", grams: 1 }] })] }), ids).error).toBe(
      "Mieszanka 2: produktu nie ma w katalogu.",
    );
    expect(parseRecipe(JSON.stringify({ mixes: [mix({ items: [{ product_id: P1, grams: 0 }] })] }), ids).error).toBe(
      "Mieszanka 1: podaj gramy (1–1000).",
    );
    expect(parseRecipe(JSON.stringify({ mixes: [mix({ zone: "x" as never })] }), ids).error).toBe("Mieszanka 1: wybierz strefę.");
    expect(parseRecipe("{nie json", ids).error).toBe("Nie udało się odczytać receptury.");
  });
});

describe("mixSummary", () => {
  const label = (id: string) => (id === P1 ? "7.1" : "8.0");
  it("skrót mieszanki", () => {
    expect(mixSummary(mix(), label)).toBe("Odrost: 7.1 30 g + 8.0 15 g · 6% 1:1,5 (67,5 g) · 35 min");
    expect(mixSummary(mix({ zone: "calosc", oxidant_percent: null, ratio: null, processing_minutes: null }), label)).toBe(
      "Całość: 7.1 30 g + 8.0 15 g · bez utleniacza",
    );
  });
});

describe("copyRecipe („Powtórz ostatnią recepturę”)", () => {
  it("kopiuje mieszanki, pomija produkty usunięte z katalogu", () => {
    const recipe = { note: "N", mixes: [mix(), mix({ zone: "konce", items: [{ product_id: P2, grams: 10 }] })] };
    const copy = copyRecipe(recipe, new Set([P1]));
    expect(copy).toEqual({ note: "N", mixes: [mix({ items: [{ product_id: P1, grams: 30 }] })] });
    expect(copy.mixes[0].items).not.toBe(recipe.mixes[0].items);
  });
});

describe("byUsage", () => {
  it("najczęściej używane na górze, remis – kolejność katalogu", () => {
    const products = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(byUsage(products, new Map([["c", 5], ["b", 1]])).map((p) => p.id)).toEqual(["c", "b", "a"]);
  });
});
