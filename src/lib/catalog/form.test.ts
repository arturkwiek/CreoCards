import { describe, expect, it } from "vitest";
import { EMPTY_PRODUCT_FORM, NEW_LINE, validateLineForm, validateProductForm, validateRequest } from "./form";

const LINE_ID = "d1000000-0000-0000-0000-0000000000a1";
const PRODUCT_ID = "e1000000-0000-0000-0000-0000000000a1";

describe("validateProductForm", () => {
  it("produkt w istniejącej linii – tylko odcień i typ są obowiązkowe", () => {
    const result = validateProductForm({ ...EMPTY_PRODUCT_FORM, line_id: LINE_ID, shade: " 7.1 " });
    expect(result.data).toEqual({
      line: { id: LINE_ID },
      product: { shade: "7.1", type: "farba", package_size: null, purchase_price: null, ratio: null },
    });
  });

  it("nowa marka i linia z domyślną proporcją; własna proporcja, pojemność i cena", () => {
    const result = validateProductForm({
      ...EMPTY_PRODUCT_FORM,
      line_id: NEW_LINE,
      brand: "Marka A",
      line_name: "Linia Classic",
      line_ratio: "1:1,5",
      shade: "7.11",
      package_size: "60",
      purchase_price: "21,50",
      ratio: "1:2",
    });
    expect(result.data).toEqual({
      line: { brand: "Marka A", name: "Linia Classic", default_ratio: 1.5 },
      product: { shade: "7.11", type: "farba", package_size: 60, purchase_price: 21.5, ratio: 2 },
    });
  });

  it("błędy pól", () => {
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, type: "" }).errors).toEqual({
      line_id: "Wybierz markę i linię.",
      shade: "Podaj odcień lub stężenie.",
      type: "Wybierz typ.",
    });
    expect(
      validateProductForm({
        ...EMPTY_PRODUCT_FORM,
        line_id: NEW_LINE,
        shade: "7.1",
        line_ratio: "dużo",
        package_size: "abc",
        purchase_price: "-1",
        ratio: "1:0",
      }).errors,
    ).toEqual({
      brand: "Podaj markę.",
      line_ratio: "Podaj proporcję, np. 1:1,5.",
      package_size: "Podaj liczbę, np. 60.",
      purchase_price: "Podaj kwotę, np. 21,50.",
      ratio: "Podaj proporcję, np. 1:1,5.",
    });
  });
});

describe("validateLineForm", () => {
  it("marka obowiązkowa, linia i proporcja opcjonalne", () => {
    expect(validateLineForm({ brand: " Marka A ", name: "", default_ratio: "" }).data).toEqual({
      brand: "Marka A",
      name: "",
      default_ratio: null,
    });
    expect(validateLineForm({ brand: "", name: "L", default_ratio: "x" }).errors).toEqual({
      brand: "Podaj markę.",
      default_ratio: "Podaj proporcję, np. 1:1,5.",
    });
  });
});

describe("validateRequest", () => {
  it("„kończy się” wymaga produktu", () => {
    expect(validateRequest("running_low", PRODUCT_ID, "")).toEqual({
      kind: "running_low",
      product_id: PRODUCT_ID,
      description: "",
    });
    expect(validateRequest("running_low", "", "")).toBe("Wybierz produkt.");
  });
  it("„brak w katalogu” wymaga opisu i nie wiąże produktu", () => {
    expect(validateRequest("missing", PRODUCT_ID, " Marka B 5.5 ")).toEqual({
      kind: "missing",
      product_id: null,
      description: "Marka B 5.5",
    });
    expect(validateRequest("missing", "", " ")).toBe("Napisz, czego brakuje (np. marka i odcień).");
    expect(validateRequest("cokolwiek", "", "x")).toBe("Wybierz rodzaj zgłoszenia.");
  });
});
