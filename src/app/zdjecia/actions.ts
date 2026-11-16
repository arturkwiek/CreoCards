"use server";

import { revalidatePath } from "next/cache";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { readImageInfo, type ImageMime } from "@/lib/photos/image-info";
import { isUuid, PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_URL_TTL_S, photoPaths, THUMB_MAX_EDGE, PHOTO_MAX_EDGE } from "@/lib/photos/photo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";
import { getVisit } from "../wizyty/data";

// Uwaga: nie logujemy ścieżek, treści plików ani danych klientek.

export type AddPhotoInput = { visitId: string; id: string; mime: ImageMime; showsFace: boolean };
export type AddPhotoResult = { ok: true } | { ok: false; error: string };

/** Ścieżki do wysłania pliku i miniatury (salon z sesji, nie od przeglądarki). */
export async function preparePhotoUpload(
  visitId: string,
  mime: ImageMime,
): Promise<{ id: string; path: string; thumb: string } | { error: string }> {
  const user = await requireUser();
  const visit = await getVisit(visitId);
  if (!visit) return { error: "Nie znaleziono wizyty." };
  if (visit.created_by !== user.id && user.role !== "owner") {
    return { error: "Zdjęcia do tej wizyty dodaje jej autorka lub właścicielka." };
  }
  if (mime !== "image/webp" && mime !== "image/jpeg") return { error: "Nieobsługiwany format zdjęcia." };
  const id = crypto.randomUUID();
  return { id, ...photoPaths(user.salonId, visit.id, id, mime) };
}

async function download(path: string): Promise<Uint8Array | null> {
  const { data } = await createAdminClient().storage.from(PHOTO_BUCKET).download(path);
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}

/**
 * Zapis zdjęcia po wysłaniu plików: sprawdza oba pliki (format, wymiary, brak EXIF/XMP – także gdy
 * ktoś ominie aplikację), a niezgodne usuwa. Wpis w attachments – z sesją osoby (RLS).
 */
export async function addPhoto(input: AddPhotoInput): Promise<AddPhotoResult> {
  const user = await requireUser();
  if (!isUuid(input.visitId) || !isUuid(input.id) || (input.mime !== "image/webp" && input.mime !== "image/jpeg")) {
    return { ok: false, error: "Nieprawidłowe zdjęcie." };
  }
  const visit = await getVisit(input.visitId);
  if (!visit || (visit.created_by !== user.id && user.role !== "owner")) {
    return { ok: false, error: "Zdjęcia do tej wizyty dodaje jej autorka lub właścicielka." };
  }

  const { path, thumb } = photoPaths(user.salonId, visit.id, input.id, input.mime);
  const [full, small] = await Promise.all([download(path), download(thumb)]);
  const fullInfo = full ? readImageInfo(full) : null;
  const thumbInfo = small ? readImageInfo(small) : null;
  const valid =
    full &&
    fullInfo &&
    thumbInfo &&
    full.length <= PHOTO_MAX_BYTES &&
    fullInfo.mime === input.mime &&
    thumbInfo.mime === input.mime &&
    fullInfo.metadata.length === 0 &&
    thumbInfo.metadata.length === 0 &&
    Math.max(fullInfo.width, fullInfo.height) <= PHOTO_MAX_EDGE &&
    Math.max(thumbInfo.width, thumbInfo.height) <= THUMB_MAX_EDGE;

  if (!valid) {
    // Plik spoza aplikacji (np. z metadanymi GPS) albo niepełne wysłanie – nie zostaje w Storage.
    if (full || small) await createAdminClient().storage.from(PHOTO_BUCKET).remove([path, thumb]);
    return {
      ok: false,
      error:
        fullInfo && fullInfo.metadata.length > 0
          ? "Zdjęcie miało metadane (np. lokalizację) i zostało odrzucone. Dodaj je przyciskiem w aplikacji."
          : "Zdjęcie nie dotarło w całości. Spróbuj ponownie.",
    };
  }

  const supabase = await createClient();
  // client_id i consent_missing ustawia trigger z wizyty (użytkownik nie ma do nich uprawnień).
  const row: Omit<TablesInsert<"attachments">, "client_id"> = {
    id: input.id,
    visit_id: visit.id,
    kind: "photo",
    storage_path: path,
    thumb_path: thumb,
    mime: input.mime,
    width: fullInfo.width,
    height: fullInfo.height,
    size_bytes: full.length,
    shows_face: input.showsFace,
  };
  const { error } = await supabase.from("attachments").insert(row as TablesInsert<"attachments">);
  if (error) return { ok: false, error: "Nie udało się zapisać zdjęcia. Spróbuj ponownie." };

  revalidatePath(`/wizyty/${visit.id}`);
  revalidatePath(`/klientki/${visit.client_id}`);
  return { ok: true };
}

/** Link do pełnego zdjęcia – tworzony w chwili otwarcia, ważny 5 min (RLS Storage: kosz tylko właścicielka). */
export async function getPhotoUrl(id: string): Promise<string | null> {
  await requireUser();
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: row } = await supabase.from("attachments").select("storage_path").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, PHOTO_URL_TTL_S);
  return data?.signedUrl ?? null;
}

/** Do kosza: osoba, która może edytować wizytę, albo właścicielka (RLS i trigger w bazie). */
export async function deletePhoto(formData: FormData): Promise<{ error?: string }> {
  await requireUser();
  const id = formString(formData, "id");
  if (!isUuid(id)) return { error: "Nie znaleziono zdjęcia." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("visit_id, client_id");
  if (error || !data?.length) return { error: "Nie udało się usunąć zdjęcia." };
  revalidatePath(`/wizyty/${data[0].visit_id}`);
  revalidatePath(`/klientki/${data[0].client_id}`);
  revalidatePath("/zdjecia/bez-zgody");
  revalidatePath("/");
  return {};
}

/** „Dopisz zgodę” z listy zdjęć bez zgody – tylko właścicielka; zgoda z dzisiejszą datą. */
export async function addPhotoConsent(formData: FormData): Promise<{ error?: string }> {
  await requireOwner();
  const clientId = formString(formData, "client_id");
  if (!isUuid(clientId)) return { error: "Nie znaleziono klientki." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ photo_consent_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("photo_consent_at", null)
    .is("deleted_at", null)
    .select("id");
  if (error || !data?.length) return { error: "Nie udało się dopisać zgody." };
  revalidatePath("/zdjecia/bez-zgody");
  revalidatePath(`/klientki/${clientId}`);
  revalidatePath("/");
  return {};
}
