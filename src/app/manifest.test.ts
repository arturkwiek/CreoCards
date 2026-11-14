import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest PWA", () => {
  const m = manifest();

  it("ma pola wymagane do instalacji", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("pl");
  });

  it("ma ikony 192 i 512 oraz maskable", () => {
    const sizes = m.icons?.map((i) => i.sizes) ?? [];
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons?.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("wszystkie ikony istnieją w public/", () => {
    for (const icon of m.icons ?? []) {
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
    }
  });
});
