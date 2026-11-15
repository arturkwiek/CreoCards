import { describe, expect, it } from "vitest";
import { parseConfirmParams } from "./confirm";

describe("parseConfirmParams", () => {
  it("przyjmuje zaproszenie i ustawienie hasła", () => {
    expect(parseConfirmParams("abcdef0123456789", "invite")).toEqual({
      tokenHash: "abcdef0123456789",
      type: "invite",
    });
    expect(parseConfirmParams("abcdef0123456789", "recovery")?.type).toBe("recovery");
  });

  it("odrzuca inne typy linków", () => {
    for (const type of ["signup", "magiclink", "email_change", "", null, undefined]) {
      expect(parseConfirmParams("abcdef0123456789", type)).toBeNull();
    }
  });

  it("odrzuca brakujący lub podejrzany token", () => {
    for (const token of [null, undefined, "", "krotki", "a b c d e f g h", "<script>alert(1)</script>"]) {
      expect(parseConfirmParams(token, "invite")).toBeNull();
    }
  });
});
