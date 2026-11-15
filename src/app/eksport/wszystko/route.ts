import type { NextRequest } from "next/server";
import { buildCsvZip, buildXlsx } from "@/lib/export/xlsx";
import { exportAll } from "../data";
import { XLSX_TYPE, fileResponse, logExport, ownerOnly, stamp } from "../response";

/** Eksport całości danych salonu: ?format=xlsx (domyślnie) albo ?format=csv (ZIP z plikami CSV). */
export async function GET(request: NextRequest) {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!(await logExport("all"))) return new Response("Nie udało się zapisać eksportu", { status: 500 });

  const sheets = await exportAll();
  return request.nextUrl.searchParams.get("format") === "csv"
    ? fileResponse(buildCsvZip(sheets), `creocards-dane-${stamp()}.zip`, "application/zip")
    : fileResponse(buildXlsx(sheets), `creocards-dane-${stamp()}.xlsx`, XLSX_TYPE);
}
