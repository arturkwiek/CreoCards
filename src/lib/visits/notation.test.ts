import { describe, expect, it } from "vitest";
import { isUsable, notationToMixes, parseNotation, type NotationProduct } from "./notation";
import { normalizeSpoken } from "./spoken";

// Wyłącznie dane testowe (marki i odcienie przykładowe).
const P = (id: string, brand: string, shade: string, line = "Linia"): NotationProduct => ({ id, brand, line, shade });
const catalog = [
  P("a9008", "Alfa", "9.008"),
  P("a836", "Alfa", "8.36"),
  P("a8000", "Alfa", "8.000"),
  P("a821", "Alfa", "8.21"),
  P("a71", "Alfa", "7.1"),
  P("a80", "Alfa", "8.0"),
  P("b71", "Beta Color", "7.1"),
  P("b60", "Beta Color", "6.0"),
];

const shades = (r: ReturnType<typeof parseNotation>, m = 0) => r.mixes[m].items.map((i) => [i.productId, i.grams]);

describe("zapis Kingi (tekst)", () => {
  const kinga = "9.008, -10g, 8.36-10g, 8.000-10g, 8.21-10g/6%";

  it("jedna mieszanka: 4 farby po 10 g, utleniacz 6%", () => {
    const r = parseNotation(kinga, catalog);
    expect(r.mixes).toHaveLength(1);
    expect(shades(r)).toEqual([
      ["a9008", 10],
      ["a836", 10],
      ["a8000", 10],
      ["a821", 10],
    ]);
    expect(r.mixes[0].oxidant_percent).toBe(6);
    expect(r.mixes[0].oxidantGiven).toBe(true);
    expect(r.skipped).toEqual([]);
  });

  it("założenia są oznaczone: „-10g” do poprzedniego odcienia, „/6%” dla całej mieszanki, domyślna strefa", () => {
    const m = parseNotation(kinga, catalog).mixes[0];
    expect(m.items[0].notes).toContain("„-10g” przypisane do 9.008 (założenie)");
    expect(m.items[1].notes).toEqual([]);
    expect(m.notes).toContain("6% – utleniacz całej mieszanki (założenie)");
    expect(m.notes).toContain("Strefa: Całość (nie podano)");
  });

  it("8.000 i 8.0 to różne produkty", () => {
    expect(shades(parseNotation("8.0-20g, 8.000-10g", catalog))).toEqual([
      ["a80", 20],
      ["a8000", 10],
    ]);
  });

  it("warianty zapisu: spacje, przecinek dziesiętny, „g”/„gr”, myślnik lub spacja", () => {
    expect(shades(parseNotation("9,008 10 g; 8.36 - 10gr", catalog), 0)).toEqual([["a9008", 10]]);
    expect(shades(parseNotation("9,008 10 g; 8.36 - 10gr", catalog), 1)).toEqual([["a836", 10]]);
    expect(shades(parseNotation("8.36-12,5g", catalog))).toEqual([["a836", 12.5]]);
  });
});

describe("dyktowanie z klawiatury (liczebniki, „kropka”, „gram”, „procent”)", () => {
  it("normalizacja słów na cyfry", () => {
    expect(normalizeSpoken("dziewięć kropka zero zero osiem dziesięć gram")).toBe("9.008 10 g");
    expect(normalizeSpoken("osiem trzydzieści sześć, dziesięć gramów")).toBe("8 36, 10 g");
    expect(normalizeSpoken("utleniacz sześć procent, proporcja jeden do półtora, czas trzydzieści pięć minut")).toBe(
      "utleniacz 6 %, proporcja 1:1,5, czas 35 min",
    );
    expect(normalizeSpoken("jeden do dwóch")).toBe("1:2");
    expect(normalizeSpoken("dziewięć przecinek zero zero osiem dziesięć gram przecinek siedem kropka jeden")).toBe(
      "9.008 10 g, 7.1",
    );
  });

  it("zapis Kingi podyktowany słowami", () => {
    const r = parseNotation(
      "dziewięć kropka zero zero osiem dziesięć gram, osiem trzydzieści sześć dziesięć gram, osiem zero zero zero dziesięć gram, osiem dwadzieścia jeden dziesięć gram, sześć procent",
      catalog,
    );
    expect(shades(r)).toEqual([
      ["a9008", 10],
      ["a836", 10],
      ["a8000", 10],
      ["a821", 10],
    ]);
    expect(r.mixes[0].oxidant_percent).toBe(6);
  });

  it("cyfry wpisane przez klawiaturę bez kropki: „9008” → 9.008 (oznaczone)", () => {
    const m = parseNotation("9008 10 g, 836 10 g", catalog).mixes[0];
    expect(m.items.map((i) => i.productId)).toEqual(["a9008", "a836"]);
    expect(m.items[0].notes).toContain("Rozpoznano jako 9.008");
  });

  it("„utleniacz 9” bez słowa procent i „bez utleniacza”", () => {
    expect(parseNotation("7.1 30 g utleniacz 9", catalog).mixes[0].oxidant_percent).toBe(9);
    const none = parseNotation("7.1 30 g bez utleniacza", catalog).mixes[0];
    expect(none.oxidant_percent).toBeNull();
    expect(none.ratio).toBeNull();
  });
});

describe("kilka mieszanek, strefy, proporcja, czas", () => {
  it("linie i strefy; proporcja i czas", () => {
    const r = parseNotation("odrost: 7.1-30g 1:1,5 6% 35 min\ndługości 8.0-40g, 8.36-20g 1:2 3%", catalog);
    expect(r.multiLine).toBe(true);
    expect(r.mixes.map((m) => [m.zone, m.oxidant_percent, m.ratio, m.processing_minutes])).toEqual([
      ["odrost", 6, 1.5, 35],
      ["dlugosci", 3, 2, null],
    ]);
    expect(shades(r, 1)).toEqual([
      ["a80", 40],
      ["a836", 20],
    ]);
  });

  it("strefa w środku linii zaczyna nową mieszankę", () => {
    const r = parseNotation("odrost 7.1-30g 6% końce 8.0-20g 3%", catalog);
    expect(r.mixes.map((m) => m.zone)).toEqual(["odrost", "konce"]);
  });

  it("brak stężenia – domyślne 6%, oznaczone", () => {
    const m = parseNotation("7.1-30g", catalog).mixes[0];
    expect(m.oxidant_percent).toBe(6);
    expect(m.oxidantGiven).toBe(false);
    expect(m.notes).toContain("Utleniacz 6% – domyślny (nie podano stężenia)");
  });
});

describe("dopasowanie do katalogu", () => {
  it("ten sam odcień w dwóch markach: marka z ostatniej receptury, potem kolejność (użycie)", () => {
    expect(parseNotation("7.1-30g", catalog).mixes[0].items[0]).toMatchObject({ productId: "a71", candidates: ["a71", "b71"] });
    expect(parseNotation("7.1-30g", catalog, ["Beta Color"]).mixes[0].items[0].productId).toBe("b71");
    expect(parseNotation("7.1-30g", catalog).mixes[0].items[0].notes).toContain("2 produkty z odcieniem 7.1 – wybrano Alfa");
  });

  it("marka w tekście wygrywa", () => {
    expect(parseNotation("Beta 7.1-30g", catalog).mixes[0].items[0].productId).toBe("b71");
  });

  it("odcień spoza katalogu i brak gramów – oznaczone, nie trafiają do receptury", () => {
    const m = parseNotation("5.5-10g, 7.1", catalog).mixes[0];
    expect(m.items[0]).toMatchObject({ productId: null, notes: ["Nie ma w katalogu"] });
    expect(m.items[1].notes).toContain("Brak gramów – uzupełnij");
    expect(m.items.map(isUsable)).toEqual([false, false]);
    expect(notationToMixes([m], () => 1.5)).toEqual([]);
  });

  it("nierozpoznane słowa trafiają do „Pominięto”", () => {
    expect(parseNotation("7.1-30g ładnie wyszło", catalog).skipped).toEqual(["ładnie", "wyszło"]);
  });

  it("pusty tekst – brak mieszanek", () => {
    expect(parseNotation("  ", catalog).mixes).toEqual([]);
  });
});

describe("notationToMixes", () => {
  it("proporcja podana albo podpowiedź z katalogu", () => {
    const r = parseNotation("7.1-30g 1:2\n8.0-20g", catalog);
    const mixes = notationToMixes(r.mixes, () => 1.5);
    expect(mixes.map((m) => [m.ratio, m.ratioGiven])).toEqual([
      [2, true],
      [1.5, false],
    ]);
    expect(mixes[0].items).toEqual([{ product_id: "a71", grams: 30 }]);
  });
});
