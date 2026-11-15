import { describe, expect, it } from "vitest";
import { filterClients, matchScore, normalizeText } from "./search";

// Wyłącznie dane testowe.
const clients = [
  { id: "1", full_name: "Anna Kowalska", phone_digits: "48600123456", updated_at: "2026-11-10T10:00:00Z" },
  { id: "2", full_name: "Łucja Żak", phone_digits: "48601555123", updated_at: "2026-11-14T10:00:00Z" },
  { id: "3", full_name: "Joanna Anusiak", phone_digits: "48700999888", updated_at: "2026-11-12T10:00:00Z" },
  { id: "4", full_name: "Anna Nowak", phone_digits: "48512123000", updated_at: "2026-11-15T10:00:00Z" },
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("normalizeText", () => {
  it("usuwa polskie znaki i wielkie litery", () => {
    expect(normalizeText("  Łucja   ŻAK ")).toBe("lucja zak");
    expect(normalizeText("Ćma Ślęża Óź")).toBe("cma sleza oz");
  });
});

describe("filterClients", () => {
  it("bez frazy: ostatnio zmienione na górze", () => {
    expect(ids(filterClients(clients, ""))).toEqual(["4", "2", "3", "1"]);
    expect(ids(filterClients(clients, "   "))).toEqual(["4", "2", "3", "1"]);
  });

  it("3 cyfry telefonu wystarczą", () => {
    expect(ids(filterClients(clients, "999"))).toEqual(["3"]);
  });

  it("dopasowanie od początku numeru wyżej niż w środku", () => {
    // „512” – początek numeru Anny Nowak, ale też fragment „…555 123” Łucji
    expect(ids(filterClients(clients, "512"))).toEqual(["4", "2"]);
    const r = ids(filterClients(clients, "601"));
    expect(r[0]).toBe("2");
  });

  it("numer wpisany ze spacjami lub z +48", () => {
    expect(ids(filterClients(clients, "600 123"))).toEqual(["1"]);
    expect(ids(filterClients(clients, "+48 700"))).toEqual(["3"]);
  });

  it("po imieniu lub nazwisku, bez polskich znaków", () => {
    expect(ids(filterClients(clients, "lucja"))).toEqual(["2"]);
    expect(ids(filterClients(clients, "zak"))).toEqual(["2"]);
    expect(ids(filterClients(clients, "ŻAK"))).toEqual(["2"]);
  });

  it("najlepsze dopasowania na górze: całe słowo > początek słowa > fragment", () => {
    // „anna”: całe słowo u Kowalskiej i Nowak (remis → ostatnio zmieniona), początek „Anusiak” nie pasuje, fragment w „Joanna”
    expect(ids(filterClients(clients, "anna"))).toEqual(["4", "1", "3"]);
  });

  it("kilka słów – każde musi pasować", () => {
    expect(ids(filterClients(clients, "anna now"))).toEqual(["4"]);
    expect(ids(filterClients(clients, "anna 999"))).toEqual(["3"]); // Joanna, 700 999 888
    expect(ids(filterClients(clients, "anna 555"))).toEqual([]);
  });

  it("brak wyników", () => {
    expect(filterClients(clients, "zzz")).toEqual([]);
  });

  it("nie zmienia przekazanej listy", () => {
    const copy = [...clients];
    filterClients(clients, "");
    expect(clients).toEqual(copy);
  });
});

describe("matchScore", () => {
  it("dokładny numer najwyżej", () => {
    const c = clients[0];
    expect(matchScore(c, "600123456")).toBeGreaterThan(matchScore(c, "600"));
    expect(matchScore(c, "600")).toBeGreaterThan(matchScore(c, "123"));
  });
});
