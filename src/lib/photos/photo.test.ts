import { describe, expect, it } from "vitest";
import { consentStep, fitWithin, isUuid, needsConsent, photoPaths, photosWord } from "./photo";

describe("fitWithin", () => {
  it("zmniejsza dłuższy bok do limitu z zachowaniem proporcji", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4000, 1, 400)).toEqual({ width: 400, height: 1 });
  });
  it("nie powiększa małych zdjęć", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("photoPaths", () => {
  const s = "a0000000-0000-4000-8000-00000000000a";
  const v = "aa000000-0000-4000-8000-0000000000a1";
  const id = "f1000000-0000-4000-8000-000000000001";
  it("ścieżka salon/wizyta/id + miniatura -m, rozszerzenie wg formatu", () => {
    expect(photoPaths(s, v, id, "image/webp")).toEqual({ path: `${s}/${v}/${id}.webp`, thumb: `${s}/${v}/${id}-m.webp` });
    expect(photoPaths(s, v, id, "image/jpeg").path.endsWith(".jpg")).toBe(true);
  });
  it("isUuid", () => {
    expect(isUuid(id)).toBe(true);
    expect(isUuid("../../x")).toBe(false);
    expect(isUuid(id.toUpperCase())).toBe(false);
  });
});

describe("zgoda na wizerunek", () => {
  it("bez zgody – pytanie o twarz; ze zgodą – bez pytań", () => {
    expect(consentStep(null)).toBe("ask-face");
    expect(consentStep("2026-11-16T12:00:00Z")).toBe("none");
  });
  it("lista „Zdjęcia bez zgody”: tylko z twarzą i bez aktualnej zgody", () => {
    expect(needsConsent(true, null)).toBe(true);
    expect(needsConsent(false, null)).toBe(false);
    expect(needsConsent(true, "2026-11-16T12:00:00Z")).toBe(false);
  });
});

describe("photosWord", () => {
  it.each([
    [1, "zdjęcie"],
    [2, "zdjęcia"],
    [5, "zdjęć"],
    [12, "zdjęć"],
    [22, "zdjęcia"],
  ])("%i %s", (n, word) => expect(photosWord(n)).toBe(word));
});
