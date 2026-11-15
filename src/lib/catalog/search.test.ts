import { describe, expect, it } from "vitest";
import { filterProducts, productScore, type SearchableProduct } from "./search";

// Wyłącznie dane testowe.
const p = (brand: string, line: string, shade: string, type: SearchableProduct["type"] = "farba") => ({
  brand,
  line,
  shade,
  type,
});

const catalog = [
  p("Marka A", "Linia Classic", "10.1"),
  p("Marka A", "Linia Classic", "7.1"),
  p("Marka A", "Linia Classic", "6.0"),
  p("Marka A", "Linia Classic", "7.11"),
  p("Marka A", "Linia Classic", "77.0"),
  p("Marka A", "Linia Classic", "7.0"),
  p("Marka B", "Koleston", "7/1"),
  p("Marka A", "Oxyd", "6%", "utleniacz"),
  p("Marka A", "Oxyd", "12%", "utleniacz"),
  p("Marka B", "Blond Plex", "Proszek", "rozjasniacz"),
];

const shades = (list: SearchableProduct[]) => list.map((x) => `${x.line} ${x.shade}`);

describe("filterProducts", () => {
  it("bez frazy: marka, linia, odcień w kolejności naturalnej", () => {
    expect(shades(filterProducts(catalog, ""))).toEqual([
      "Linia Classic 6.0",
      "Linia Classic 7.0",
      "Linia Classic 7.1",
      "Linia Classic 7.11",
      "Linia Classic 10.1",
      "Linia Classic 77.0",
      "Oxyd 6%",
      "Oxyd 12%",
      "Blond Plex Proszek",
      "Koleston 7/1",
    ]);
  });

  it("„7.1” pokazuje odcienie 7.1 (także zapisane jako 7/1) na górze, potem 7.11", () => {
    const result = shades(filterProducts(catalog, "7.1"));
    expect(result).toEqual(["Linia Classic 7.1", "Koleston 7/1", "Linia Classic 7.11"]);
  });

  it("„7,1” i „7/1” dają ten sam wynik co „7.1”", () => {
    expect(filterProducts(catalog, "7,1")).toEqual(filterProducts(catalog, "7.1"));
    expect(filterProducts(catalog, "7/1")).toEqual(filterProducts(catalog, "7.1"));
  });

  it("„7” pokazuje poziom 7, ale nie 77.0 ani 10.1", () => {
    expect(shades(filterProducts(catalog, "7"))).toEqual([
      "Linia Classic 7.0",
      "Linia Classic 7.1",
      "Linia Classic 7.11",
      "Koleston 7/1",
    ]);
  });

  it("„6%” i „6” znajdują utleniacz 6%", () => {
    expect(shades(filterProducts(catalog, "6%"))).toEqual(["Oxyd 6%"]);
    expect(shades(filterProducts(catalog, "6"))).toEqual(["Linia Classic 6.0", "Oxyd 6%"]);
  });

  it("marka, linia i typ słowami; każde słowo musi pasować", () => {
    expect(shades(filterProducts(catalog, "koleston"))).toEqual(["Koleston 7/1"]);
    expect(shades(filterProducts(catalog, "classic 7.1"))).toEqual(["Linia Classic 7.1", "Linia Classic 7.11"]);
    expect(shades(filterProducts(catalog, "rozjaś"))).toEqual(["Blond Plex Proszek"]);
    expect(filterProducts(catalog, "xyz")).toEqual([]);
  });

  it("filtr typu", () => {
    expect(shades(filterProducts(catalog, "", "utleniacz"))).toEqual(["Oxyd 6%", "Oxyd 12%"]);
    expect(shades(filterProducts(catalog, "6", "utleniacz"))).toEqual(["Oxyd 6%"]);
  });

  it("wynik 0 dla braku dopasowania", () => {
    expect(productScore(p("A", "B", "10.1"), "1")).toBe(0);
    expect(productScore(p("A", "B", "7.1"), "7.1")).toBeGreaterThan(productScore(p("A", "B", "7.11"), "7.1"));
  });
});
