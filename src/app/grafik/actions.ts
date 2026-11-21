"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/catalog/form";
import { EMPTY_CLIENT_FORM, isAllergyStatus, validateClientForm } from "@/lib/clients/form";
import {
  DURATION_MAX,
  DURATION_MIN,
  NOTE_MAX,
  STATUSES,
  dayHref,
  dayOf,
  endTime,
  findConflicts,
  startsAt,
  timeOf,
  type AppointmentStatus,
} from "@/lib/schedule/day";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation";
import { getServiceNames } from "../wizyty/data";
import { getAppointment, getDayAppointments, getTeam } from "./data";

// Uwaga: nie logujemy treści formularza (imiona, telefony, alergie).

export type AppointmentFormState = {
  error?: string;
  /** Pole z błędem nowej klientki. */
  clientErrors?: { full_name?: string; phone?: string; allergy_status?: string };
  /** Kolizje z innymi terminami tej osoby – zapis po „Zapisz mimo to”. */
  conflicts?: string[];
};

/** Nowy termin (bez id) albo zmiana: osoba, dzień, godzina, czas trwania, usługa, klientka (istniejąca lub nowa), notatka. */
export async function saveAppointment(_prev: AppointmentFormState, formData: FormData): Promise<AppointmentFormState> {
  const user = await requireUser();
  const id = formString(formData, "id");
  if (id && !isUuid(id)) return { error: "Nie znaleziono terminu." };

  const existing = id ? await getAppointment(id) : null;
  if (id && (!existing || existing.deleted_at)) return { error: "Nie znaleziono terminu." };
  if (existing && existing.staff_id !== user.id && user.role !== "owner") {
    return { error: "Ten termin może zmienić tylko osoba, do której należy, lub właścicielka." };
  }

  const staffId = formString(formData, "staff_id") || user.id;
  if (staffId !== user.id && user.role !== "owner") return { error: "Termin innej osobie dodaje tylko właścicielka." };
  if (!(await getTeam()).some((m) => m.id === staffId)) return { error: "Wybierz osobę z zespołu." };

  const start = startsAt(formString(formData, "day"), formString(formData, "time"));
  if (!start) return { error: "Wybierz dzień i godzinę." };

  const duration = Number(formString(formData, "duration_min"));
  if (!Number.isInteger(duration) || duration < DURATION_MIN || duration > DURATION_MAX) {
    return { error: "Czas trwania: od 5 min do 12 h." };
  }

  const serviceId = formString(formData, "service_id");
  if (serviceId && !isUuid(serviceId)) return { error: "Wybierz usługę z listy." };

  const note = formString(formData, "note").trim();
  if (note.length > NOTE_MAX) return { error: `Notatka: najwyżej ${NOTE_MAX} znaków.` };

  // Klientka z bazy albo nowa (imię, telefon, alergie – „nieuzupełnione” dozwolone przy rezerwacji).
  const newClient = formString(formData, "new_client") === "1";
  let clientId = formString(formData, "client_id");
  let clientInput = null;
  if (newClient) {
    const status = formString(formData, "new_allergy_status");
    const result = validateClientForm(
      {
        ...EMPTY_CLIENT_FORM,
        full_name: formString(formData, "new_full_name"),
        phone: formString(formData, "new_phone"),
        allergy_status: isAllergyStatus(status) ? status : "",
      },
      { allowUnknown: true },
    );
    if (result.errors) {
      const { full_name, phone, allergy_status } = result.errors;
      return { clientErrors: { full_name, phone, allergy_status }, error: "Uzupełnij dane nowej klientki." };
    }
    clientInput = result.data;
  } else if (!isUuid(clientId)) {
    return { error: "Wybierz klientkę albo dodaj nową." };
  }

  // Kolizje w grafiku tej osoby – ostrzeżenie, zapis po potwierdzeniu (nic nie blokuje zapisu).
  if (formString(formData, "confirm") !== "1") {
    const sameDay = await getDayAppointments(dayOf(start), staffId);
    const conflicts = findConflicts({ id: id || undefined, starts_at: start, duration_min: duration }, sameDay);
    if (conflicts.length > 0) {
      const services = await getServiceNames();
      return {
        conflicts: conflicts.map((c) =>
          [
            `${timeOf(c.starts_at)}–${endTime(c.starts_at, c.duration_min)}`,
            c.client?.full_name ?? "Klientka",
            c.service_id ? services.get(c.service_id) : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      };
    }
  }

  const supabase = await createClient();
  if (clientInput) {
    const { data, error } = await supabase.from("clients").insert(clientInput).select("id").single();
    if (error || !data) return { error: "Nie udało się zapisać klientki. Spróbuj ponownie." };
    clientId = data.id;
  }

  const fields = {
    staff_id: staffId,
    client_id: clientId,
    service_id: serviceId || null,
    starts_at: start,
    duration_min: duration,
    note,
  };
  if (existing) {
    const { error } = await supabase.from("appointments").update(fields).eq("id", existing.id).is("deleted_at", null);
    if (error) return { error: "Nie udało się zapisać terminu. Spróbuj ponownie." };
  } else {
    const { error } = await supabase.from("appointments").insert(fields);
    if (error) return { error: "Nie udało się zapisać terminu. Spróbuj ponownie." };
  }

  revalidatePath("/grafik");
  revalidatePath(`/klientki/${clientId}`);
  redirect(dayHref(dayOf(start), staffId, user.id));
}

/** Zmiana statusu (umówiona / odbyła się / odwołana / nie przyszła). */
export async function setAppointmentStatus(formData: FormData): Promise<void> {
  await requireUser();
  const id = formString(formData, "id");
  const status = formString(formData, "status") as AppointmentStatus;
  if (!isUuid(id) || !STATUSES.includes(status)) return;
  const supabase = await createClient();
  await supabase.from("appointments").update({ status }).eq("id", id).is("deleted_at", null);
  revalidatePath("/grafik");
  revalidatePath(`/grafik/${id}`);
}

/** Do kosza – osoba, do której należy termin, lub właścicielka (RLS); przywraca właścicielka. */
export async function deleteAppointment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = formString(formData, "id");
  const appointment = await getAppointment(id);
  if (!appointment || appointment.deleted_at) return;
  const supabase = await createClient();
  await supabase.from("appointments").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
  revalidatePath("/grafik");
  revalidatePath(`/klientki/${appointment.client_id}`);
  redirect(dayHref(dayOf(appointment.starts_at), appointment.staff_id, user.id));
}
