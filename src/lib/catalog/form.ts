/**
 * Formularze katalogu: produkt (z wyborem istniejącej linii albo nową marką i linią),
 * linia oraz zgłoszenie „Zgłoś brak”. Wartości jako tekst (kontrolowane pola), walidacja po stronie serwera.
 */
import { formString } from "@/lib/validation";
import {
  BRAND_MAX,
  LINE_MAX,
  REQUEST_TEXT_MAX,
  SHADE_MAX,
  parsePackageSize,
  parsePrice,
  parseProductType,
  parseRatio,
  type ProductRequestKind,
  type ProductType,
} from "./values";

/** Wartość pola linii oznaczająca „nowa marka / linia”. */
export const NEW_LINE = "new";

export type ProductFormValues = {
  line_id: string;
  brand: string;
  line_name: string;
  line_ratio: string;
  shade: string;
  type: string;
  package_size: string;
  purchase_price: string;
  ratio: string;
};

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  line_id: "",
  brand: "",
  line_name: "",
  line_ratio: "",
  shade: "",
  type: "farba",
  package_size: "",
  purchase_price: "",
  ratio: "",
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

export type ValidProduct = {
  line: { id: string } | { brand: string; name: string; default_ratio: number | null };
  product: {
    shade: string;
    type: ProductType;
    package_size: number | null;
    purchase_price: number | null;
    ratio: number | null;
  };
};

export function readProductForm(formData: FormData): ProductFormValues {
  const values = { ...EMPTY_PRODUCT_FORM };
  for (const key of Object.keys(values) as (keyof ProductFormValues)[]) values[key] = formString(formData, key);
  return values;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

const RATIO_ERROR = "Podaj proporcję, np. 1:1,5.";

export function validateProductForm(
  values: ProductFormValues,
): { data: ValidProduct; errors?: undefined } | { data?: undefined; errors: ProductFormErrors } {
  const errors: ProductFormErrors = {};
  let line: ValidProduct["line"] | null = null;

  if (values.line_id === NEW_LINE) {
    const brand = values.brand.trim();
    const name = values.line_name.trim();
    const lineRatio = parseRatio(values.line_ratio);
    if (!brand) errors.brand = "Podaj markę.";
    else if (brand.length > BRAND_MAX) errors.brand = `Maks. ${BRAND_MAX} znaków.`;
    if (name.length > LINE_MAX) errors.line_name = `Maks. ${LINE_MAX} znaków.`;
    if (lineRatio === "invalid") errors.line_ratio = RATIO_ERROR;
    else line = { brand, name, default_ratio: lineRatio };
  } else if (isUuid(values.line_id)) {
    line = { id: values.line_id };
  } else {
    errors.line_id = "Wybierz markę i linię.";
  }

  const shade = values.shade.trim();
  if (!shade) errors.shade = "Podaj odcień lub stężenie.";
  else if (shade.length > SHADE_MAX) errors.shade = `Maks. ${SHADE_MAX} znaków.`;

  const type = parseProductType(values.type);
  if (!type) errors.type = "Wybierz typ.";

  const size = parsePackageSize(values.package_size);
  if (size === "invalid") errors.package_size = "Podaj liczbę, np. 60.";
  const price = parsePrice(values.purchase_price);
  if (price === "invalid") errors.purchase_price = "Podaj kwotę, np. 21,50.";
  const ratio = parseRatio(values.ratio);
  if (ratio === "invalid") errors.ratio = RATIO_ERROR;

  if (Object.keys(errors).length > 0 || !line || !type || size === "invalid" || price === "invalid" || ratio === "invalid") {
    return { errors };
  }
  return {
    data: { line, product: { shade, type, package_size: size, purchase_price: price, ratio } },
  };
}

export type LineFormValues = { brand: string; name: string; default_ratio: string };
export type LineFormErrors = Partial<Record<keyof LineFormValues, string>>;

export function validateLineForm(
  values: LineFormValues,
):
  | { data: { brand: string; name: string; default_ratio: number | null }; errors?: undefined }
  | { data?: undefined; errors: LineFormErrors } {
  const errors: LineFormErrors = {};
  const brand = values.brand.trim();
  const name = values.name.trim();
  const ratio = parseRatio(values.default_ratio);
  if (!brand) errors.brand = "Podaj markę.";
  else if (brand.length > BRAND_MAX) errors.brand = `Maks. ${BRAND_MAX} znaków.`;
  if (name.length > LINE_MAX) errors.name = `Maks. ${LINE_MAX} znaków.`;
  if (ratio === "invalid") errors.default_ratio = RATIO_ERROR;
  if (Object.keys(errors).length > 0 || ratio === "invalid") return { errors };
  return { data: { brand, name, default_ratio: ratio } };
}

export type RequestInput = { kind: ProductRequestKind; product_id: string | null; description: string };

/** „Kończy się” – produkt z katalogu; „brak w katalogu” – opis tego, czego brakuje. */
export function validateRequest(kindValue: string, productId: string, description: string): RequestInput | string {
  const text = description.trim();
  if (text.length > REQUEST_TEXT_MAX) return `Maks. ${REQUEST_TEXT_MAX} znaków.`;
  if (kindValue === "running_low") {
    if (!isUuid(productId)) return "Wybierz produkt.";
    return { kind: "running_low", product_id: productId, description: text };
  }
  if (kindValue === "missing") {
    if (!text) return "Napisz, czego brakuje (np. marka i odcień).";
    return { kind: "missing", product_id: null, description: text };
  }
  return "Wybierz rodzaj zgłoszenia.";
}
