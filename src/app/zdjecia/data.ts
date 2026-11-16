import "server-only";
import { PHOTO_BUCKET, THUMB_URL_TTL_S } from "@/lib/photos/photo";
import { createClient } from "@/lib/supabase/server";

export type PhotoThumb = {
  id: string;
  visitId: string;
  thumbUrl: string | null;
  width: number;
  height: number;
  showsFace: boolean;
  createdBy: string;
  createdAt: string;
};

type Row = {
  id: string;
  visit_id: string;
  thumb_path: string;
  width: number;
  height: number;
  shows_face: boolean;
  created_by: string;
  created_at: string;
};

/** Podpisane linki do miniatur (30 min) – jedno wywołanie dla całej listy; RLS Storage pilnuje dostępu. */
export async function signThumbs(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, THUMB_URL_TTL_S);
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}

async function withThumbs(rows: Row[]): Promise<PhotoThumb[]> {
  const urls = await signThumbs(rows.map((r) => r.thumb_path));
  return rows.map((r) => ({
    id: r.id,
    visitId: r.visit_id,
    thumbUrl: urls.get(r.thumb_path) ?? null,
    width: r.width,
    height: r.height,
    showsFace: r.shows_face,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
}

const COLUMNS = "id, visit_id, thumb_path, width, height, shows_face, created_by, created_at";

/** Aktywne zdjęcia wizyt (od najstarszego) pogrupowane po wizycie. */
export async function getVisitPhotos(visitIds: readonly string[]): Promise<Map<string, PhotoThumb[]>> {
  const result = new Map<string, PhotoThumb[]>();
  if (visitIds.length === 0) return result;
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select(COLUMNS)
    .in("visit_id", [...visitIds])
    .eq("kind", "photo")
    .is("deleted_at", null)
    .order("created_at")
    .limit(1000);
  for (const photo of await withThumbs(data ?? [])) {
    const list = result.get(photo.visitId) ?? [];
    list.push(photo);
    result.set(photo.visitId, list);
  }
  return result;
}

/** Oś czasu: do `perVisit` miniatur na wizytę + liczba wszystkich zdjęć wizyty. */
export async function getTimelinePhotos(
  visitIds: readonly string[],
  perVisit = 3,
): Promise<Map<string, { thumbs: PhotoThumb[]; total: number }>> {
  const result = new Map<string, { thumbs: PhotoThumb[]; total: number }>();
  if (visitIds.length === 0) return result;
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select(COLUMNS)
    .in("visit_id", [...visitIds])
    .eq("kind", "photo")
    .is("deleted_at", null)
    .order("created_at")
    .limit(2000);
  const shown: Row[] = [];
  const totals = new Map<string, number>();
  for (const r of data ?? []) {
    const n = (totals.get(r.visit_id) ?? 0) + 1;
    totals.set(r.visit_id, n);
    if (n <= perVisit) shown.push(r);
  }
  for (const photo of await withThumbs(shown)) {
    const entry = result.get(photo.visitId) ?? { thumbs: [], total: totals.get(photo.visitId) ?? 0 };
    entry.thumbs.push(photo);
    result.set(photo.visitId, entry);
  }
  return result;
}

export type PhotoWithoutConsent = PhotoThumb & { clientId: string; clientName: string };

/** Właścicielka: zdjęcia z twarzą, których klientka (dziś) nie ma zgody na wizerunek. */
export async function getPhotosWithoutConsent(): Promise<PhotoWithoutConsent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select(`${COLUMNS}, client_id, clients!inner(full_name, photo_consent_at, deleted_at)`)
    .eq("kind", "photo")
    .eq("shows_face", true)
    .is("deleted_at", null)
    .is("clients.photo_consent_at", null)
    .is("clients.deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = data ?? [];
  const thumbs = await withThumbs(rows);
  return thumbs.map((t, i) => ({ ...t, clientId: rows[i].client_id, clientName: rows[i].clients.full_name }));
}

export async function countPhotosWithoutConsent(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("attachments")
    .select("id, clients!inner(photo_consent_at, deleted_at)", { count: "exact", head: true })
    .eq("kind", "photo")
    .eq("shows_face", true)
    .is("deleted_at", null)
    .is("clients.photo_consent_at", null)
    .is("clients.deleted_at", null);
  return count ?? 0;
}
