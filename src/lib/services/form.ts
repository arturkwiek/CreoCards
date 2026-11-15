/** Formularz usługi (właścicielka): nazwa obowiązkowa, reszta opcjonalna. */
import { SERVICE_NAME_MAX, parseDuration, parseServicePrice } from "./import";

export type ServiceFormValues = {
  name: string;
  price_from: string;
  price_to: string;
  duration_min: string;
  with_color: boolean;
};

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  name: "",
  price_from: "",
  price_to: "",
  duration_min: "",
  with_color: false,
};

export type ServiceFormErrors = Partial<Record<keyof ServiceFormValues, string>>;

export type ValidService = {
  name: string;
  price_from: number | null;
  price_to: number | null;
  duration_min: number | null;
  with_color: boolean;
};

export function validateServiceForm(
  values: ServiceFormValues,
): { data: ValidService; errors?: undefined } | { data?: undefined; errors: ServiceFormErrors } {
  const errors: ServiceFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Podaj nazwę usługi.";
  else if (name.length > SERVICE_NAME_MAX) errors.name = `Maks. ${SERVICE_NAME_MAX} znaków.`;
  const from = parseServicePrice(values.price_from);
  const to = parseServicePrice(values.price_to);
  if (from === "invalid") errors.price_from = "Podaj kwotę, np. 150.";
  if (to === "invalid") errors.price_to = "Podaj kwotę, np. 250.";
  if (typeof from === "number" && typeof to === "number" && to < from) errors.price_to = "Cena do nie może być niższa niż od.";
  const duration = parseDuration(values.duration_min);
  if (duration === "invalid") errors.duration_min = "Podaj minuty, np. 90.";
  if (Object.keys(errors).length > 0 || from === "invalid" || to === "invalid" || duration === "invalid") {
    return { errors };
  }
  return { data: { name, price_from: from, price_to: to, duration_min: duration, with_color: values.with_color } };
}
