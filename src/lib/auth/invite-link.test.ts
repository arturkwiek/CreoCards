import { describe, expect, it } from "vitest";
import { buildAuthLink, buildInviteLink } from "./invite-link";

describe("buildInviteLink", () => {
  it("buduje link do /auth/confirm z typem invite", () => {
    const link = new URL(buildInviteLink("https://creo.example.app", "abc123"));
    expect(link.origin).toBe("https://creo.example.app");
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("token_hash")).toBe("abc123");
    expect(link.searchParams.get("type")).toBe("invite");
  });

  it("ignoruje ścieżkę w adresie bazowym i koduje token", () => {
    const link = new URL(buildInviteLink("http://localhost:3000/zespol", "a+b/c"));
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("token_hash")).toBe("a+b/c");
  });
});

describe("buildAuthLink", () => {
  it("link do ustawienia hasła ma typ recovery", () => {
    const link = new URL(buildAuthLink("https://creo.example.app", "tok", "recovery"));
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("type")).toBe("recovery");
    expect(link.searchParams.get("token_hash")).toBe("tok");
  });

  it("link nie zawiera adresu e-mail ani innych danych osobowych", () => {
    const link = new URL(buildAuthLink("https://creo.example.app", "tok", "recovery"));
    expect([...link.searchParams.keys()].sort()).toEqual(["token_hash", "type"]);
  });
});
