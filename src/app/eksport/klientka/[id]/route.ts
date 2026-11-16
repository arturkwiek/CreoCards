import { zipSync } from "fflate";
import { buildXlsx } from "@/lib/export/xlsx";
import { PHOTO_BUCKET } from "@/lib/photos/photo";
import { createClient } from "@/lib/supabase/server";
import { exportClient } from "../../data";
import { fileResponse, logExport, ownerOnly, stamp } from "../../response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dane jednej klientki (RODO) jako ZIP: XLSX (karta, wizyty, receptury, lista zdjęć) + pliki zdjęć
 * (także z kosza – prawo dostępu obejmuje wszystkie przechowywane dane). Nazwa pliku bez imienia klientki.
 */
export async function GET(_request: Request, { params }: RouteContext<"/eksport/klientka/[id]">) {
  const denied = await ownerOnly();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Nie znaleziono", { status: 404 });

  const data = await exportClient(id);
  if (!data) return new Response("Nie znaleziono", { status: 404 });

  const date = stamp();
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    [`creocards-klientka-${date}.xlsx`]: buildXlsx(data.sheets),
  };
  const storage = (await createClient()).storage.from(PHOTO_BUCKET);
  for (const photo of data.photos) {
    const { data: blob } = await storage.download(photo.path);
    if (!blob) return new Response("Nie udało się pobrać zdjęć klientki", { status: 500 });
    // Zdjęcia są już skompresowane – bez ponownej kompresji.
    files[photo.name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  }

  if (!(await logExport("client", id))) return new Response("Nie udało się zapisać eksportu", { status: 500 });
  return fileResponse(zipSync(files), `creocards-klientka-${date}.zip`, "application/zip");
}
