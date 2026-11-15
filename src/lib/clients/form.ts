import { isValidEmail, normalizeEmail } from "@/lib/validation";
import { normalizePhone } from "./phone";

export const CLIENT_NAME_MAX = 120;
export const CLIENT_TEXT_MAX = 2000;

export type AllergyStatus = "none" | "has";

/** Wartości formularza (to, co wpisała osoba) – zwracane przy błędzie, żeby nic nie zginęło. */
export type ClientFormValues = {
  full_name: string;
  phone: string;
  allergy_status: AllergyStatus | "";
  allergies: string;
  email: string;
  note: string;
  rodo_consent: boolean;
  notifications_consent: boolean;
};

export type ClientFormErrors = Partial<Record<"full_name" | "phone" | "allergy_status" | "email" | "allergies" | "note", string>>;

/** Dane gotowe do zapisu (bez zgód – te zależą od poprzedniego stanu, patrz consentTimestamp). */
export type ClientInput = {
  full_name: string;
  phone: string;
  allergy_status: AllergyStatus;
  allergies: string;
  email: string | null;
  note: string;
};

export const EMPTY_CLIENT_FORM: ClientFormValues = {
  full_name: "",
  phone: "",
  allergy_status: "",
  allergies: "",
  email: "",
  note: "",
  rodo_consent: false,
  notifications_consent: false,
};

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export function readClientForm(formData: FormData): ClientFormValues {
  const status = text(formData, "allergy_status");
  return {
    full_name: text(formData, "full_name"),
    phone: text(formData, "phone"),
    allergy_status: status === "none" || status === "has" ? status : "",
    allergies: text(formData, "allergies"),
    email: text(formData, "email"),
    note: text(formData, "note"),
    rodo_consent: formData.get("rodo_consent") === "on",
    notifications_consent: formData.get("notifications_consent") === "on",
  };
}

/** Obowiązkowe: imię i nazwisko, telefon, wybór alergii. Reszta opcjonalna i nie blokuje zapisu. */
export function validateClientForm(
  values: ClientFormValues,
): { data: ClientInput; errors?: undefined } | { data?: undefined; errors: ClientFormErrors } {
  const errors: ClientFormErrors = {};

  const fullName = values.full_name.trim().replace(/\s+/g, " ");
  if (!fullName) errors.full_name = "Wpisz imię i nazwisko.";
  else if (fullName.length > CLIENT_NAME_MAX) errors.full_name = `Najwyżej ${CLIENT_NAME_MAX} znaków.`;

  const phone = normalizePhone(values.phone);
  if (!values.phone.trim()) errors.phone = "Wpisz numer telefonu.";
  else if (!phone) errors.phone = "Sprawdź numer – np. 600 123 456.";

  if (!values.allergy_status) errors.allergy_status = "Zaznacz, czy klientka ma alergie.";

  const allergies = values.allergy_status === "has" ? values.allergies.trim() : "";
  if (allergies.length > CLIENT_TEXT_MAX) errors.allergies = `Najwyżej ${CLIENT_TEXT_MAX} znaków.`;

  const email = normalizeEmail(values.email);
  if (email && !isValidEmail(email)) errors.email = "Sprawdź adres e-mail albo zostaw puste.";

  const note = values.note.trim();
  if (note.length > CLIENT_TEXT_MAX) errors.note = `Najwyżej ${CLIENT_TEXT_MAX} znaków.`;

  if (Object.keys(errors).length > 0 || !phone || !values.allergy_status) return { errors };

  return {
    data: {
      full_name: fullName,
      phone,
      allergy_status: values.allergy_status,
      allergies,
      email: email || null,
      note,
    },
  };
}

/** Data zgody: zachowuje pierwotną datę, ustawia teraz przy nowej zgodzie, czyści przy cofnięciu. */
export function consentTimestamp(checked: boolean, previous: string | null, now: string): string | null {
  if (!checked) return null;
  return previous ?? now;
}
