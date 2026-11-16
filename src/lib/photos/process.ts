/**
 * Przetwarzanie zdjęcia na telefonie (tylko w przeglądarce): obrót wg aparatu, zmniejszenie do 1600 px,
 * zapis WebP (lub JPEG, gdy przeglądarka nie zapisuje WebP) i miniatura 400 px.
 * Ponowny zapis przez canvas nie przenosi metadanych (EXIF, GPS) – dodatkowo sprawdzamy to przed wysłaniem.
 */
import { readImageInfo, type ImageMime } from "./image-info";
import { fitWithin, JPEG_QUALITY, PHOTO_MAX_BYTES, PHOTO_MAX_EDGE, THUMB_MAX_EDGE, WEBP_QUALITY } from "./photo";

export type ProcessedPhoto = {
  full: Blob;
  thumb: Blob;
  mime: ImageMime;
  width: number;
  height: number;
};

export class PhotoError extends Error {}

type Source = { image: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: Blob): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Niektóre przeglądarki nie dekodują danego formatu przez createImageBitmap – próbujemy <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError("Nie można odczytać zdjęcia – zrób je aparatem z aplikacji.");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: ImageMime, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(src: Source, maxEdge: number, mime?: ImageMime): Promise<{ blob: Blob; mime: ImageMime; width: number; height: number }> {
  const size = fitWithin(src.width, src.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("Telefon nie pozwala przetworzyć zdjęcia.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.image, 0, 0, size.width, size.height);

  if (mime !== "image/jpeg") {
    const webp = await toBlob(canvas, "image/webp", WEBP_QUALITY);
    // Safari na starszych iPhone'ach zamiast WebP zwraca PNG – wtedy JPEG.
    if (webp && webp.type === "image/webp") return { blob: webp, mime: "image/webp", ...size };
    if (mime === "image/webp") throw new PhotoError("Nie udało się zapisać miniatury.");
  }
  const jpeg = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (!jpeg) throw new PhotoError("Nie udało się zapisać zdjęcia.");
  return { blob: jpeg, mime: "image/jpeg", ...size };
}

async function assertClean(blob: Blob): Promise<void> {
  const info = readImageInfo(new Uint8Array(await blob.arrayBuffer()));
  if (!info) throw new PhotoError("Nie udało się przygotować zdjęcia.");
  if (info.metadata.length > 0) throw new PhotoError("Zdjęcie ma metadane (np. lokalizację) – nie zostało wysłane.");
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const src = await decode(file);
  try {
    if (!src.width || !src.height) throw new PhotoError("Nie można odczytać zdjęcia.");
    const full = await encode(src, PHOTO_MAX_EDGE);
    const thumb = await encode(src, THUMB_MAX_EDGE, full.mime);
    if (full.blob.size > PHOTO_MAX_BYTES) throw new PhotoError("Zdjęcie jest za duże.");
    await assertClean(full.blob);
    await assertClean(thumb.blob);
    return { full: full.blob, thumb: thumb.blob, mime: full.mime, width: full.width, height: full.height };
  } finally {
    src.close();
  }
}
