import { describe, expect, it } from "vitest";
import { consentTimestamp, EMPTY_CLIENT_FORM, readClientForm, validateClientForm, type ClientFormValues } from "./form";

// Wyłącznie dane testowe.
const valid: ClientFormValues = {
  ...EMPTY_CLIENT_FORM,
  full_name: "  Anna   Testowa ",
  phone: "600 123 456",
  allergy_status: "none",
};

describe("validateClientForm", () => {
  it("minimum: imię i nazwisko, telefon, wybór alergii", () => {
    const result = validateClientForm(valid);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      full_name: "Anna Testowa",
      phone: "+48600123456",
      allergy_status: "none",
      allergies: "",
      email: null,
      note: "",
    });
  });

  it("brak pól obowiązkowych – komunikaty przy każdym", () => {
    const { errors } = validateClientForm(EMPTY_CLIENT_FORM);
    expect(Object.keys(errors ?? {}).sort()).toEqual(["allergy_status", "full_name", "phone"]);
  });

  it("wybór alergii jest obowiązkowy, opis – nie", () => {
    expect(validateClientForm({ ...valid, allergy_status: "" }).errors?.allergy_status).toBeDefined();
    const has = validateClientForm({ ...valid, allergy_status: "has", allergies: "" });
    expect(has.errors).toBeUndefined();
    expect(has.data?.allergy_status).toBe("has");
  });

  it("opis alergii zapisany tylko przy „Są alergie”", () => {
    expect(validateClientForm({ ...valid, allergy_status: "has", allergies: " PPD " }).data?.allergies).toBe("PPD");
    expect(validateClientForm({ ...valid, allergy_status: "none", allergies: "PPD" }).data?.allergies).toBe("");
  });

  it("zły telefon", () => {
    expect(validateClientForm({ ...valid, phone: "123" }).errors?.phone).toMatch(/Sprawdź numer/);
  });

  it("e-mail opcjonalny, ale jeśli podany – poprawny", () => {
    expect(validateClientForm({ ...valid, email: "" }).data?.email).toBeNull();
    expect(validateClientForm({ ...valid, email: " Anna@Example.COM " }).data?.email).toBe("anna@example.com");
    expect(validateClientForm({ ...valid, email: "anna@" }).errors?.email).toBeDefined();
  });

  it("za długie imię i notatka", () => {
    expect(validateClientForm({ ...valid, full_name: "a".repeat(121) }).errors?.full_name).toBeDefined();
    expect(validateClientForm({ ...valid, note: "a".repeat(2001) }).errors?.note).toBeDefined();
  });
});

describe("readClientForm", () => {
  it("czyta pola i zgody z formularza", () => {
    const fd = new FormData();
    fd.set("full_name", "Anna");
    fd.set("phone", "600123456");
    fd.set("allergy_status", "has");
    fd.set("rodo_consent", "on");
    const values = readClientForm(fd);
    expect(values).toMatchObject({ full_name: "Anna", allergy_status: "has", rodo_consent: true, notifications_consent: false });
  });

  it("nieznany status alergii → brak wyboru", () => {
    const fd = new FormData();
    fd.set("allergy_status", "moze");
    expect(readClientForm(fd).allergy_status).toBe("");
  });
});

describe("consentTimestamp", () => {
  const now = "2026-11-15T12:00:00.000Z";
  it("nowa zgoda – teraz", () => expect(consentTimestamp(true, null, now)).toBe(now));
  it("istniejąca zgoda – zachowana data", () => expect(consentTimestamp(true, "2026-01-01T00:00:00Z", now)).toBe("2026-01-01T00:00:00Z"));
  it("cofnięta zgoda – null", () => expect(consentTimestamp(false, "2026-01-01T00:00:00Z", now)).toBeNull());
});
