import { describe, expect, it } from "vitest";
import { FULL_NAME_MAX_LENGTH, greeting, needsFullName, parseFullName } from "./name";

describe("greeting", () => {
  it("z imieniem", () => {
    expect(greeting("Kinga")).toBe("Cześć, Kinga!");
  });

  it("bez imienia – bez pustego miejsca i przecinka", () => {
    for (const value of ["", "   ", null, undefined]) {
      expect(greeting(value)).toBe("Cześć!");
    }
  });
});

describe("needsFullName", () => {
  it("zachęta, gdy imienia brak lub same spacje", () => {
    expect(needsFullName("")).toBe(true);
    expect(needsFullName("  ")).toBe(true);
    expect(needsFullName(null)).toBe(true);
  });

  it("brak zachęty, gdy imię jest", () => {
    expect(needsFullName("Artur")).toBe(false);
  });
});

describe("parseFullName", () => {
  it("przycina i scala spacje", () => {
    expect(parseFullName("  Anna   Maria ")).toBe("Anna Maria");
  });

  it("odrzuca puste, za długie i nie-tekst", () => {
    expect(parseFullName("   ")).toBeNull();
    expect(parseFullName("a".repeat(FULL_NAME_MAX_LENGTH + 1))).toBeNull();
    expect(parseFullName(null)).toBeNull();
  });

  it("przyjmuje imię o maksymalnej długości", () => {
    expect(parseFullName("a".repeat(FULL_NAME_MAX_LENGTH))).toHaveLength(FULL_NAME_MAX_LENGTH);
  });
});
