// Jednorazowe założenie salonu i zaproszenie właścicielki.
// Użycie (WSL): npm run bootstrap -- --salon "Creo" --email adres@domena.pl [--name "Imię"]
//   --link [--site-url https://adres-aplikacji]  – wypisz link zaproszenia zamiast wysyłać e-mail
//                                                  (domyślnie STAGING_SITE_URL albo https://creo-cards.vercel.app)
// Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    salon: { type: "string" },
    email: { type: "string" },
    name: { type: "string", default: "" },
    link: { type: "boolean", default: false },
    "site-url": { type: "string" },
  },
});

const salonName = values.salon?.trim();
const email = values.email?.trim().toLowerCase();
if (!salonName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(
    'Użycie: npm run bootstrap -- --salon "Creo" --email adres@domena.pl [--name "Imię"] [--link [--site-url https://…]]',
  );
  process.exit(1);
}

const DEFAULT_SITE_URL = "https://creo-cards.vercel.app"; // główny adres stagingu
const siteUrl = (values["site-url"] ?? process.env.STAGING_SITE_URL ?? DEFAULT_SITE_URL)
  .trim()
  .replace(/\/+$/, "");
if (values.link && !/^https?:\/\/[^/]+$/.test(siteUrl)) {
  console.error("Opcja --link wymaga adresu aplikacji: --site-url https://… albo zmiennej STAGING_SITE_URL.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing } = await admin
  .from("salons")
  .select("id")
  .eq("name", salonName)
  .is("deleted_at", null)
  .maybeSingle();

let salonId = existing?.id;
if (salonId) {
  console.log(`Salon „${salonName}” już istnieje – używam go.`);
} else {
  const { data: salon, error } = await admin
    .from("salons")
    .insert({ name: salonName })
    .select("id")
    .single();
  if (error) {
    console.error("Nie udało się utworzyć salonu:", error.message);
    process.exit(1);
  }
  salonId = salon.id;
  console.log(`Utworzono salon „${salonName}”.`);
}

const { data: pending } = await admin
  .from("invitations")
  .select("id, salon_id, role")
  .eq("email", email)
  .is("accepted_at", null)
  .is("deleted_at", null)
  .maybeSingle();

if (pending) {
  if (pending.salon_id !== salonId || pending.role !== "owner") {
    console.error("Na ten adres czeka już inne zaproszenie (inny salon lub rola). Anuluj je najpierw.");
    process.exit(1);
  }
  console.log("Zaproszenie właścicielki już istnieje – ponawiam wysyłkę.");
} else {
  const { error: invitationError } = await admin
    .from("invitations")
    .insert({ salon_id: salonId, email, role: "owner", full_name: values.name.trim() });
  if (invitationError) {
    console.error("Nie udało się zapisać zaproszenia:", invitationError.message);
    process.exit(1);
  }
}

if (values.link) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (error || !data?.properties?.hashed_token) {
    console.error("Nie udało się utworzyć linku zaproszenia:", error?.message);
    process.exit(1);
  }
  const link = new URL("/auth/confirm", siteUrl);
  link.searchParams.set("token_hash", data.properties.hashed_token);
  link.searchParams.set("type", "invite");
  console.log("Link zaproszenia właścicielki (jednorazowy, ważny 24 h – nie udostępniaj innym):");
  console.log(link.toString());
} else {
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    console.error("Nie udało się wysłać e-maila z zaproszeniem:", inviteError.message);
    process.exit(1);
  }
  console.log("Wysłano zaproszenie właścicielki. Sprawdź skrzynkę i kliknij link.");
}
