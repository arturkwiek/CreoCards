import "server-only";
import { cache } from "react";
import { visibleEmail } from "@/lib/auth/login";
import { isUuid } from "@/lib/catalog/form";
import { dayRange, type AppointmentStatus } from "@/lib/schedule/day";
import { createClient } from "@/lib/supabase/server";

// Uwaga: nie logujemy danych klientek (imiona, telefony).

export type Appointment = {
  id: string;
  staff_id: string;
  client_id: string;
  service_id: string | null;
  starts_at: string;
  duration_min: number;
  note: string;
  status: AppointmentStatus;
  visit_id: string | null;
  created_by: string;
  deleted_at: string | null;
  client: { full_name: string; phone: string; allergy_status: "none" | "has" | "unknown" } | null;
};

const COLUMNS =
  "id, staff_id, client_id, service_id, starts_at, duration_min, note, status, visit_id, created_by, deleted_at, clients(full_name, phone, allergy_status)";

type Row = Omit<Appointment, "client"> & { clients: Appointment["client"] };
const toAppointment = ({ clients, ...a }: Row): Appointment => ({ ...a, client: clients });

/** Aktywne terminy dnia (Warszawa) – jednej osoby albo całego zespołu (staffId = null). */
export async function getDayAppointments(day: string, staffId: string | null): Promise<Appointment[]> {
  const { from, to } = dayRange(day);
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(COLUMNS)
    .is("deleted_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");
  if (staffId) query = query.eq("staff_id", staffId);
  const { data } = await query;
  return ((data ?? []) as unknown as Row[]).map(toAppointment);
}

export const getAppointment = cache(async (id: string): Promise<Appointment | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("appointments").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toAppointment(data as unknown as Row) : null;
});

/** Nadchodzące (od dziś) aktywne terminy klientki – na karcie klientki. */
export async function getClientAppointments(clientId: string, fromIso: string): Promise<Appointment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(COLUMNS)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .gte("starts_at", fromIso)
    .order("starts_at")
    .limit(10);
  return ((data ?? []) as unknown as Row[]).map(toAppointment);
}

export type TeamMember = { id: string; name: string; role: "owner" | "apprentice" };

/** Aktywny zespół (komu można przypisać termin): właścicielki na górze, potem alfabetycznie. */
export const getTeam = cache(async (): Promise<TeamMember[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("id, full_name, login, email, role").is("deleted_at", null);
  return (data ?? [])
    .map((u) => ({ id: u.id, name: u.full_name || u.login || visibleEmail(u.email), role: u.role }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "pl") : a.role === "owner" ? -1 : 1));
});

/** Klientki do wyboru w terminie (bez alergii – tylko status do znacznika). */
export async function getClientChoices() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone, phone_digits, allergy_status, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((c) => ({ ...c, phone_digits: c.phone_digits ?? "" }));
}

export type ClientChoice = Awaited<ReturnType<typeof getClientChoices>>[number];
