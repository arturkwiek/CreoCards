import "server-only";
import { visibleEmail } from "@/lib/auth/login";
import type { Cell, Sheet } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";
import { ZONE_LABELS, type MixZone } from "@/lib/visits/recipe";
import { formatVisitDate } from "@/lib/visits/time";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

const PAGE = 1000;

/** Wszystkie wiersze tabeli (RLS: salon zalogowanej osoby), stronicowane – PostgREST oddaje maks. 1000 naraz. */
async function fetchAll(supabase: Supabase, table: string, columns = "*"): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table as "clients")
      .select(columns)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Eksport: nie udało się odczytać tabeli ${table}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  return JSON.stringify(value);
}

function sheet(name: string, rows: Row[], columns?: string[]): Sheet {
  const header = columns ?? (rows[0] ? Object.keys(rows[0]) : ["id"]);
  return { name, rows: [header, ...rows.map((r) => header.map((c) => toCell(r[c])))] };
}

/**
 * Całość danych salonu – surowe kolumny tabel (także usunięte miękko, z deleted_at), do archiwum i ewentualnego odtworzenia.
 * Zespół bez adresów technicznych kont z loginem.
 */
export async function exportAll(): Promise<Sheet[]> {
  const supabase = await createClient();
  const tables = [
    ["klientki", "clients"],
    ["wizyty", "visits"],
    ["receptury", "recipes"],
    ["mieszanki", "recipe_mixes"],
    ["farby_w_mieszankach", "mix_items"],
    ["produkty", "products"],
    ["linie_produktow", "product_lines"],
    ["uslugi", "services"],
    ["zgloszenia_brakow", "product_requests"],
    ["zdjecia", "attachments"],
  ] as const;
  const sheets: Sheet[] = [];
  for (const [name, table] of tables) sheets.push(sheet(name, await fetchAll(supabase, table)));
  const team = (await fetchAll(supabase, "users", "id, full_name, login, email, role, created_at, deleted_at")).map((u) => ({
    ...u,
    email: visibleEmail(u.email as string),
  }));
  sheets.push(sheet("zespol", team, ["id", "full_name", "login", "email", "role", "created_at", "deleted_at"]));
  return sheets;
}

const yesNo = (v: unknown) => (v ? `tak (${formatVisitDate(String(v))})` : "nie");

export type ClientExport = {
  sheets: Sheet[];
  /** Zdjęcia do dołączenia: ścieżka w Storage → nazwa w archiwum. */
  photos: { path: string; name: string }[];
};

/** Dane jednej klientki (RODO): karta, zgody, wizyty, receptury i zdjęcia – w czytelnej postaci. */
export async function exportClient(clientId: string): Promise<ClientExport | null> {
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client) return null;

  const [{ data: visits }, { data: services }, { data: team }, { data: attachments }] = await Promise.all([
    supabase.from("visits").select("*").eq("client_id", clientId).order("visit_at"),
    supabase.from("services").select("id, name"),
    supabase.from("users").select("id, full_name, login, email"),
    supabase
      .from("attachments")
      .select("id, visit_id, storage_path, mime, shows_face, consent_missing, created_by, created_at, deleted_at")
      .eq("client_id", clientId)
      .order("created_at"),
  ]);
  const visitIds = (visits ?? []).map((v) => v.id);
  const { data: recipes } = visitIds.length
    ? await supabase.from("recipes").select("*").in("visit_id", visitIds).is("deleted_at", null)
    : { data: [] };
  const recipeIds = (recipes ?? []).map((r) => r.id);
  const { data: mixes } = recipeIds.length
    ? await supabase.from("recipe_mixes").select("*").in("recipe_id", recipeIds).is("deleted_at", null).order("position")
    : { data: [] };
  const mixIds = (mixes ?? []).map((m) => m.id);
  const { data: items } = mixIds.length
    ? await supabase.from("mix_items").select("*").in("mix_id", mixIds).is("deleted_at", null).order("position")
    : { data: [] };
  const productIds = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, shade, line_id").in("id", productIds)
    : { data: [] };
  const lineIds = [...new Set((products ?? []).map((p) => p.line_id))];
  const { data: lines } = lineIds.length
    ? await supabase.from("product_lines").select("id, brand, name").in("id", lineIds)
    : { data: [] };

  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const personName = new Map((team ?? []).map((u) => [u.id, u.full_name || u.login || visibleEmail(u.email)]));
  const lineName = new Map((lines ?? []).map((l) => [l.id, [l.brand, l.name].filter(Boolean).join(" ")]));
  const productName = new Map((products ?? []).map((p) => [p.id, `${lineName.get(p.line_id) ?? ""} ${p.shade}`.trim()]));
  const visitById = new Map((visits ?? []).map((v) => [v.id, v]));
  const recipeById = new Map((recipes ?? []).map((r) => [r.id, r]));

  const card: Cell[][] = [
    ["Pole", "Wartość"],
    ["Imię i nazwisko", client.full_name],
    ["Telefon", client.phone],
    ["E-mail", client.email],
    ["Alergie", client.allergy_status === "has" ? "są alergie / uwagi" : "brak znanych alergii"],
    ["Opis alergii", client.allergies],
    ["Notatka", client.note],
    ["Zgoda RODO", yesNo(client.rodo_consent_at)],
    ["Zgoda na powiadomienia", yesNo(client.notifications_consent_at)],
    ["Zgoda na zdjęcia (wizerunek)", yesNo(client.photo_consent_at)],
    ["Dodana", formatVisitDate(client.created_at, true)],
    ["Ostatnia zmiana", formatVisitDate(client.updated_at, true)],
    ["Usunięta", client.deleted_at ? formatVisitDate(client.deleted_at, true) : "nie"],
  ];
  const visitRows: Cell[][] = [
    ["Data", "Usługa", "Wykonała", "Cena (zł)", "Usunięta"],
    ...(visits ?? []).map((v) => [
      formatVisitDate(v.visit_at, true),
      (v.service_id && serviceName.get(v.service_id)) || "",
      personName.get(v.created_by) ?? "",
      v.price,
      v.deleted_at ? "tak" : "",
    ]),
  ];
  const recipeRows: Cell[][] = [
    ["Data wizyty", "Mieszanka", "Strefa", "Produkt", "Gramy", "Utleniacz (%)", "Proporcja (1:x)", "Utleniacz (g)", "Czas (min)", "Notatka"],
  ];
  for (const m of mixes ?? []) {
    const recipe = recipeById.get(m.recipe_id);
    const visit = recipe && visitById.get(recipe.visit_id);
    for (const i of (items ?? []).filter((x) => x.mix_id === m.id)) {
      recipeRows.push([
        visit ? formatVisitDate(visit.visit_at, true) : "",
        m.position + 1,
        ZONE_LABELS[m.zone as MixZone],
        productName.get(i.product_id) ?? "",
        i.grams,
        m.oxidant_percent,
        m.ratio,
        m.oxidant_grams,
        m.processing_minutes,
        recipe?.note ?? "",
      ]);
    }
  }
  const photos: ClientExport["photos"] = [];
  const photoRows: Cell[][] = [["Plik", "Data zdjęcia", "Data wizyty", "Dodała", "Z twarzą", "Dodane bez zgody", "W koszu"]];
  for (const a of attachments ?? []) {
    const visit = visitById.get(a.visit_id);
    const name = `zdjecia/${a.created_at.slice(0, 10)}_${String(photos.length + 1).padStart(3, "0")}.${a.mime === "image/webp" ? "webp" : "jpg"}`;
    photos.push({ path: a.storage_path, name });
    photoRows.push([
      name,
      formatVisitDate(a.created_at, true),
      visit ? formatVisitDate(visit.visit_at, true) : "",
      personName.get(a.created_by) ?? "",
      a.shows_face ? "tak" : "nie",
      a.consent_missing ? "tak" : "",
      a.deleted_at ? "tak" : "",
    ]);
  }
  return {
    sheets: [
      { name: "Klientka", rows: card },
      { name: "Wizyty", rows: visitRows },
      { name: "Receptury", rows: recipeRows },
      { name: "Zdjęcia", rows: photoRows },
    ],
    photos,
  };
}
