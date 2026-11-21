import "server-only";
import type { CurrentUser } from "@/lib/auth/session";
import { getServices } from "../wizyty/data";
import type { FormClient, FormMember, FormService } from "./appointment-form";
import { getClientChoices, getTeam } from "./data";

/** Dane formularza terminu: zespół (tylko dla właścicielki), usługi, klientki. */
export async function loadAppointmentFormData(user: CurrentUser): Promise<{
  team: FormMember[] | null;
  services: FormService[];
  clients: FormClient[];
}> {
  const [team, services, clients] = await Promise.all([getTeam(), getServices(), getClientChoices()]);
  return {
    team: user.role === "owner" ? team.map(({ id, name }) => ({ id, name: id === user.id ? `${name} (ja)` : name })) : null,
    services: services.map(({ id, name, duration_min }) => ({ id, name, duration_min })),
    clients,
  };
}
