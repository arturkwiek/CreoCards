/**
 * Odczyt nagłówków JPEG/WebP bez dekodowania obrazu: format, wymiary i metadane (EXIF, XMP, IPTC).
 * Używane na telefonie (przed wysłaniem) i na serwerze (kontrola wysłanego pliku).
 */

export type ImageMime = "image/webp" | "image/jpeg";

export type ImageInfo = {
  mime: ImageMime;
  width: number;
  height: number;
  /** Nazwy znalezionych bloków metadanych, np. ["EXIF"]; pusta lista = plik czysty. */
  metadata: string[];
};

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

// Znaczniki SOF z wymiarami (bez DHT C4, JPG C8, DAC CC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readJpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const metadata: string[] = [];
  let width = 0;
  let height = 0;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // EOI / początek danych obrazu
    if (marker >= 0xd0 && marker <= 0xd7) {
      i += 2;
      continue;
    }
    const len = u16be(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    const data = i + 4;
    if (marker === 0xe1) {
      if (ascii(b, data, 6) === "Exif\0\0") metadata.push("EXIF");
      else if (ascii(b, data, 28) === "http://ns.adobe.com/xap/1.0/") metadata.push("XMP");
      else metadata.push("APP1");
    } else if (marker === 0xed) {
      metadata.push("IPTC");
    } else if (marker === 0xe2 && ascii(b, data, 11) === "ICC_PROFILE") {
      // Profil kolorów – nie zawiera danych osobowych ani lokalizacji.
    } else if (marker >= 0xe3 && marker <= 0xef) {
      metadata.push(`APP${marker - 0xe0}`);
    } else if (marker === 0xfe) {
      metadata.push("COM");
    } else if (SOF.has(marker) && len >= 7) {
      height = u16be(b, data + 1);
      width = u16be(b, data + 3);
    }
    i += 2 + len;
  }
  if (!width || !height) return null;
  return { mime: "image/jpeg", width, height, metadata };
}

function readWebp(b: Uint8Array): ImageInfo | null {
  if (b.length < 20 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const metadata: string[] = [];
  let width = 0;
  let height = 0;
  let i = 12;
  while (i + 8 <= b.length) {
    const fourcc = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    const data = i + 8;
    if (data + size > b.length) return null;
    if (fourcc === "VP8X" && size >= 10) {
      const flags = b[data];
      if (flags & 0x08) metadata.push("EXIF");
      if (flags & 0x04) metadata.push("XMP");
      width = u24le(b, data + 4) + 1;
      height = u24le(b, data + 7) + 1;
    } else if (fourcc === "VP8 " && size >= 10 && !width) {
      if (b[data + 3] !== 0x9d || b[data + 4] !== 0x01 || b[data + 5] !== 0x2a) return null;
      width = u16le(b, data + 6) & 0x3fff;
      height = u16le(b, data + 8) & 0x3fff;
    } else if (fourcc === "VP8L" && size >= 5 && !width) {
      if (b[data] !== 0x2f) return null;
      const bits = u32le(b, data + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (fourcc === "EXIF") {
      if (!metadata.includes("EXIF")) metadata.push("EXIF");
    } else if (fourcc === "XMP ") {
      if (!metadata.includes("XMP")) metadata.push("XMP");
    }
    i = data + size + (size % 2);
  }
  if (!width || !height) return null;
  return { mime: "image/webp", width, height, metadata };
}

/** Format, wymiary i metadane pliku; null, gdy to nie jest poprawny JPEG ani WebP. */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  return readJpeg(bytes) ?? readWebp(bytes);
}
