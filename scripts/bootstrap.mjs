// Jednorazowe założenie salonu i zaproszenie właścicielki.
// Użycie (WSL): npm run bootstrap -- --salon "Creo" --email adres@domena.pl [--name "Imię"]
// Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    salon: { type: "string" },
    email: { type: "string" },
    name: { type: "string", default: "" },
  },
});

const salonName = values.salon?.trim();
const email = values.email?.trim().toLowerCase();
if (!salonName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Użycie: npm run bootstrap -- --salon "Creo" --email adres@domena.pl [--name "Imię"]');
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

const { error: invitationError } = await admin
  .from("invitations")
  .insert({ salon_id: salonId, email, role: "owner", full_name: values.name.trim() });
if (invitationError) {
  console.error("Nie udało się zapisać zaproszenia:", invitationError.message);
  process.exit(1);
}

const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
if (inviteError) {
  console.error("Nie udało się wysłać e-maila z zaproszeniem:", inviteError.message);
  process.exit(1);
}

console.log("Wysłano zaproszenie właścicielki. Sprawdź skrzynkę i kliknij link.");
