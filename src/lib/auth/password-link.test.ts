import { describe, expect, it, vi } from "vitest";
import { createAuthLink, EMAIL_EXISTS_MESSAGE, type GenerateLink } from "./password-link";

const ORIGIN = "https://creo.example.app";
// Sztuczny token testowy – prawdziwe tokeny nigdy nie trafiają do testów ani logów.
const FAKE_TOKEN = "fake-token-for-tests";

const ok: GenerateLink = async () => ({
  data: { properties: { hashed_token: FAKE_TOKEN } },
  error: null,
});

describe("createAuthLink", () => {
  it("link do ustawienia hasła: generateLink z typem recovery i link /auth/confirm?type=recovery", async () => {
    const generate = vi.fn(ok);
    const result = await createAuthLink(generate, ORIGIN, "osoba@example.com", "recovery");

    expect(generate).toHaveBeenCalledWith("recovery", "osoba@example.com");
    const link = new URL(result.link!);
    expect(link.origin).toBe(ORIGIN);
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("type")).toBe("recovery");
    expect(link.searchParams.get("token_hash")).toBe(FAKE_TOKEN);
  });

  it("link nie zawiera adresu e-mail", async () => {
    const result = await createAuthLink(ok, ORIGIN, "osoba@example.com", "recovery");
    expect(result.link).not.toContain("osoba");
    expect(result.link).not.toContain("example.com/");
  });

  it("zaproszenie: generateLink z typem invite", async () => {
    const generate = vi.fn(ok);
    const result = await createAuthLink(generate, ORIGIN, "nowa@example.com", "invite");
    expect(generate).toHaveBeenCalledWith("invite", "nowa@example.com");
    expect(new URL(result.link!).searchParams.get("type")).toBe("invite");
  });

  it("zaproszenie na adres z kontem w innym salonie – czytelny komunikat", async () => {
    const result = await createAuthLink(
      async () => ({ data: null, error: { code: "email_exists" } }),
      ORIGIN,
      "zajety@example.com",
      "invite",
    );
    expect(result).toEqual({ error: EMAIL_EXISTS_MESSAGE });
  });

  it("błąd Auth przy linku do hasła – ogólny komunikat, bez linku", async () => {
    const result = await createAuthLink(
      async () => ({ data: null, error: { code: "user_not_found" } }),
      ORIGIN,
      "brak@example.com",
      "recovery",
    );
    expect(result.link).toBeUndefined();
    expect(result.error).toBe("Nie udało się utworzyć linku do ustawienia hasła.");
  });

  it("brak tokenu w odpowiedzi traktowany jak błąd", async () => {
    const result = await createAuthLink(
      async () => ({ data: { properties: {} }, error: null }),
      ORIGIN,
      "osoba@example.com",
      "recovery",
    );
    expect(result.link).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});
