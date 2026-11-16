import { describe, expect, it } from "vitest";
import { readImageInfo } from "./image-info";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

function segment(marker: number, payload: number[]) {
  return [0xff, marker, ...be16(payload.length + 2), ...payload];
}
const str = (s: string) => [...s].map((c) => c.charCodeAt(0));
const app0 = segment(0xe0, [...str("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const sof0 = (w: number, h: number) => segment(0xc0, [8, ...be16(h), ...be16(w), 1, 1, 0x11, 0]);
const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34];
const jpeg = (...segments: number[][]) => bytes([0xff, 0xd8], ...segments, sos, [0xff, 0xd9]);

function riff(...chunks: number[][]) {
  const body = chunks.flat();
  return bytes("RIFF", le32(body.length + 4), "WEBP", body);
}
function chunk(fourcc: string, payload: number[]) {
  const pad = payload.length % 2 ? [0] : [];
  return [...str(fourcc), ...le32(payload.length), ...payload, ...pad];
}
const vp8 = (w: number, h: number) => chunk("VP8 ", [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h), 0, 0]);

describe("readImageInfo – JPEG", () => {
  it("czysty JPEG z płótna (tylko JFIF): wymiary, bez metadanych", () => {
    expect(readImageInfo(jpeg(app0, sof0(1600, 1200)))).toEqual({ mime: "image/jpeg", width: 1600, height: 1200, metadata: [] });
  });

  it("wykrywa EXIF (np. GPS z aparatu)", () => {
    const exif = segment(0xe1, [...str("Exif\0\0"), ...str("MM"), 0, 42, 0, 0, 0, 8]);
    expect(readImageInfo(jpeg(exif, sof0(4000, 3000)))?.metadata).toEqual(["EXIF"]);
  });

  it("wykrywa XMP, IPTC i komentarz", () => {
    const xmp = segment(0xe1, [...str("http://ns.adobe.com/xap/1.0/"), 0, ...str("<x/>")]);
    const iptc = segment(0xed, str("Photoshop 3.0\0"));
    const com = segment(0xfe, str("opis"));
    expect(readImageInfo(jpeg(xmp, iptc, com, sof0(10, 10)))?.metadata).toEqual(["XMP", "IPTC", "COM"]);
  });

  it("profil kolorów ICC nie jest metadanymi osobowymi", () => {
    const icc = segment(0xe2, [...str("ICC_PROFILE\0"), 1, 1]);
    expect(readImageInfo(jpeg(app0, icc, sof0(20, 30)))?.metadata).toEqual([]);
  });

  it("uszkodzony lub obcy plik → null", () => {
    expect(readImageInfo(bytes([0xff, 0xd8, 0x00, 0x11]))).toBeNull();
    expect(readImageInfo(bytes("\x89PNG\r\n\x1a\n"))).toBeNull();
    expect(readImageInfo(jpeg(app0))).toBeNull();
  });
});

describe("readImageInfo – WebP", () => {
  it("bezstratny WebP 1×1 (VP8L)", () => {
    const b = Uint8Array.from(atob("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="), (c) => c.charCodeAt(0));
    expect(readImageInfo(b)).toEqual({ mime: "image/webp", width: 1, height: 1, metadata: [] });
  });

  it("stratny WebP (VP8) – wymiary z nagłówka ramki", () => {
    expect(readImageInfo(riff(vp8(1600, 900)))).toEqual({ mime: "image/webp", width: 1600, height: 900, metadata: [] });
  });

  it("VP8X z flagą i blokiem EXIF → wykryte", () => {
    const vp8x = chunk("VP8X", [0x08, 0, 0, 0, ...le24(1599), ...le24(1199)]);
    const exif = chunk("EXIF", [...str("MM"), 0, 42]);
    expect(readImageInfo(riff(vp8x, vp8(1600, 1200), exif))).toEqual({
      mime: "image/webp",
      width: 1600,
      height: 1200,
      metadata: ["EXIF"],
    });
  });

  it("blok XMP bez flagi też jest wykrywany", () => {
    expect(readImageInfo(riff(vp8(10, 10), chunk("XMP ", str("<x/>"))))?.metadata).toEqual(["XMP"]);
  });

  it("obcięty plik → null", () => {
    const full = riff(vp8(10, 10));
    expect(readImageInfo(full.subarray(0, full.length - 4))).toBeNull();
  });
});
