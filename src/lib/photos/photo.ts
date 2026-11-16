/** Parametry i czyste funkcje Etapu 5 (zdjęcia) – wspólne dla telefonu i serwera. */
import type { ImageMime } from "./image-info";

export const PHOTO_BUCKET = "photos";
export const PHOTO_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 400;
export const WEBP_QUALITY = 0.8;
export const JPEG_QUALITY = 0.82;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Miniatury (lista, oś czasu) – 30 min; pełne zdjęcie – link tworzony przy otwarciu, 5 min. */
export const THUMB_URL_TTL_S = 30 * 60;
export const PHOTO_URL_TTL_S = 5 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Wymiary po zmniejszeniu tak, by dłuższy bok ≤ max (bez powiększania). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export const extensionOf = (mime: ImageMime) => (mime === "image/webp" ? "webp" : "jpg");

/** Ścieżki pliku i miniatury: <salon>/<wizyta>/<id>.<ext> i <salon>/<wizyta>/<id>-m.<ext>. */
export function photoPaths(salonId: string, visitId: string, id: string, mime: ImageMime) {
  const base = `${salonId}/${visitId}/${id}`;
  const ext = extensionOf(mime);
  return { path: `${base}.${ext}`, thumb: `${base}-m.${ext}` };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type ConsentStep = "none" | "ask-face";

/** Czy przed dodaniem zdjęcia zapytać o twarz: tylko gdy klientka nie ma zgody na wizerunek. */
export function consentStep(photoConsentAt: string | null): ConsentStep {
  return photoConsentAt ? "none" : "ask-face";
}

/** Czy zdjęcie trafia na listę „Zdjęcia bez zgody”: z twarzą i klientka (dziś) bez zgody. */
export function needsConsent(showsFace: boolean, photoConsentAt: string | null): boolean {
  return showsFace && !photoConsentAt;
}

/** Odmiana „zdjęcie”: 1 zdjęcie, 2–4 zdjęcia, 5+ zdjęć. */
export function photosWord(n: number): string {
  if (n === 1) return "zdjęcie";
  const tens = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? "zdjęcia" : "zdjęć";
}
