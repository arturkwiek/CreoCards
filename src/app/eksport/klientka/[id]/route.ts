import { buildXlsx } from "@/lib/export/xlsx";
import { exportClient } from "../../data";
import { XLSX_TYPE, fileResponse, logExport, ownerOnly, stamp } from "../../response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dane jednej klientki (RODO) jako XLSX. Nazwa pliku bez imienia klientki. */
export async function GET(_request: Request, { params }: RouteContext<"/eksport/klientka/[id]">) {
  const denied = await ownerOnly();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Nie znaleziono", { status: 404 });

  const sheets = await exportClient(id);
  if (!sheets) return new Response("Nie znaleziono", { status: 404 });
  if (!(await logExport("client", id))) return new Response("Nie udało się zapisać eksportu", { status: 500 });
  return fileResponse(buildXlsx(sheets), `creocards-klientka-${stamp()}.xlsx`, XLSX_TYPE);
}
