"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { CLIENT_NAME_MAX, type AllergyStatus } from "@/lib/clients/form";
import { formatPhone } from "@/lib/clients/phone";
import { filterClients } from "@/lib/clients/search";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DURATION_MAX,
  DURATION_MIN,
  DURATION_PRESETS,
  NOTE_MAX,
  SLOT_MIN,
  addDays,
  endTime,
  startsAt,
  todayWarsaw,
} from "@/lib/schedule/day";
import { formatDuration } from "@/lib/services/import";
import { saveAppointment, type AppointmentFormState } from "./actions";

export type FormClient = { id: string; full_name: string; phone: string; phone_digits: string; allergy_status: AllergyStatus; updated_at: string };
export type FormService = { id: string; name: string; duration_min: number | null };
export type FormMember = { id: string; name: string };

export type AppointmentInitial = {
  id?: string;
  staff_id: string;
  day: string;
  time: string;
  duration_min: number;
  service_id: string;
  client_id: string;
  note: string;
};

const chip = "min-h-11 rounded-xl border px-3 py-2 text-base font-medium";
const on = "border-brand bg-brand text-white";
const off = "border-foreground/20 text-foreground";
const input = "h-12 min-w-0 rounded-xl border border-foreground/20 bg-background px-3 text-base outline-none focus:border-brand";

const NEW_ALLERGY: { value: AllergyStatus; label: string }[] = [
  { value: "unknown", label: "Nie wiem – zapytam przy wizycie" },
  { value: "none", label: "Brak znanych alergii" },
  { value: "has", label: "Są alergie / uwagi" },
];

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const MINUTES = Array.from({ length: 60 / SLOT_MIN }, (_, i) => i * SLOT_MIN);
const pad = (n: number) => String(n).padStart(2, "0");

/** Termin: osoba (wybór – właścicielka), dzień, godzina, usługa, czas trwania, klientka (z bazy albo nowa), notatka. */
export function AppointmentForm({
  initial,
  team,
  services,
  clients,
  cancelHref,
}: {
  initial: AppointmentInitial;
  /** Lista osób – tylko dla właścicielki (inaczej termin zawsze dla siebie). */
  team: FormMember[] | null;
  services: FormService[];
  clients: FormClient[];
  cancelHref: string;
}) {
  const [state, action] = useActionState<AppointmentFormState, FormData>(saveAppointment, {});
  const [staffId, setStaffId] = useState(initial.staff_id);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(initial.duration_min);
  const [serviceId, setServiceId] = useState(initial.service_id);
  const [clientId, setClientId] = useState(initial.client_id);
  const [query, setQuery] = useState("");
  const [newClient, setNewClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAllergy, setNewAllergy] = useState<AllergyStatus>("unknown");
  const [note, setNote] = useState(initial.note);

  const client = clients.find((c) => c.id === clientId);
  const results = useMemo(() => (query.trim() ? filterClients(clients, query) : clients).slice(0, 6), [clients, query]);
  const [hour, minute] = time.split(":").map(Number);
  const start = startsAt(day, time);
  const today = todayWarsaw();
  const errors = state.clientErrors ?? {};

  const pickService = (s: FormService) => {
    const next = serviceId === s.id ? "" : s.id;
    setServiceId(next);
    if (next && s.duration_min) setDuration(Math.min(DURATION_MAX, Math.max(DURATION_MIN, s.duration_min)));
  };

  const startNewClient = () => {
    const q = query.trim();
    if (/^[\d\s()+-]+$/.test(q)) setNewPhone(q);
    else setNewName(q);
    setNewClient(true);
  };

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="duration_min" value={duration} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="client_id" value={newClient ? "" : clientId} />
      <input type="hidden" name="new_client" value={newClient ? "1" : ""} />
      <input type="hidden" name="new_allergy_status" value={newAllergy} />

      {team && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Osoba</legend>
          <div className="flex flex-wrap gap-2">
            {team.map((m) => (
              <button key={m.id} type="button" aria-pressed={staffId === m.id} onClick={() => setStaffId(m.id)} className={`${chip} ${staffId === m.id ? on : off}`}>
                {m.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Klientka</legend>
        {client && !newClient ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-foreground/5 px-4 py-3">
            <p className="min-w-0">
              <span className="font-semibold">{client.full_name}</span>
              <span className="block text-sm text-foreground/60">{formatPhone(client.phone)}</span>
              {client.allergy_status === "unknown" && (
                <span className="block text-sm text-red-700 dark:text-red-400">Alergie nieuzupełnione</span>
              )}
            </p>
            <button type="button" onClick={() => setClientId("")} className="text-sm text-brand">
              Zmień
            </button>
          </div>
        ) : newClient ? (
          <div className="flex flex-col gap-3 rounded-xl border border-brand/40 p-3">
            <p className="text-sm font-medium">Nowa klientka</p>
            <label htmlFor="new-client-name" className="text-sm">
              Imię i nazwisko
            </label>
            <input
              id="new-client-name"
              name="new_full_name"
              autoComplete="off"
              autoCapitalize="words"
              maxLength={CLIENT_NAME_MAX}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-invalid={Boolean(errors.full_name)}
              className={input}
            />
            {errors.full_name && <p className="text-sm text-red-700 dark:text-red-400">{errors.full_name}</p>}
            <label htmlFor="new-client-phone" className="text-sm">
              Telefon
            </label>
            <input
              id="new-client-phone"
              name="new_phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="600 123 456"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              aria-invalid={Boolean(errors.phone)}
              className={input}
            />
            {errors.phone && <p className="text-sm text-red-700 dark:text-red-400">{errors.phone}</p>}
            <div role="group" aria-label="Alergie" className="flex flex-col gap-2">
              <p className="text-sm">Alergie / uwagi zdrowotne</p>
              {NEW_ALLERGY.map((o) => (
                <button key={o.value} type="button" aria-pressed={newAllergy === o.value} onClick={() => setNewAllergy(o.value)} className={`${chip} ${newAllergy === o.value ? on : off}`}>
                  {o.label}
                </button>
              ))}
              {newAllergy === "has" && (
                <p className="text-xs text-foreground/60">Opis alergii dopiszesz na karcie klientki.</p>
              )}
            </div>
            <button type="button" onClick={() => setNewClient(false)} className="text-sm text-foreground/60">
              Wybierz z listy
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="search"
              aria-label="Szukaj klientki"
              placeholder="Imię albo 3 cyfry telefonu"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={input}
            />
            <ul className="flex flex-col">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setClientId(c.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-foreground/10 px-1 text-left active:bg-foreground/5"
                  >
                    <span className="truncate font-medium">{c.full_name}</span>
                    <span className="shrink-0 text-sm text-foreground/60">{formatPhone(c.phone)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {query.trim() && results.length === 0 && <p className="text-sm text-foreground/60">Nie ma takiej klientki.</p>}
            <button type="button" onClick={startNewClient} className={`${buttonStyles.secondary} h-11`}>
              + Nowa klientka
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Dzień</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={day === today} onClick={() => setDay(today)} className={`${chip} ${day === today ? on : off}`}>
            Dziś
          </button>
          <button type="button" aria-pressed={day === addDays(today, 1)} onClick={() => setDay(addDays(today, 1))} className={`${chip} ${day === addDays(today, 1) ? on : off}`}>
            Jutro
          </button>
          <label htmlFor="appointment-day" className="sr-only">
            Data
          </label>
          <input id="appointment-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${input} flex-1`} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          Godzina: {time}
          {start && ` – ${endTime(start, duration)}`}
        </legend>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Godzina">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={hour === h}
              onClick={() => setTime(`${pad(h)}:${pad(minute || 0)}`)}
              className={`min-h-11 rounded-xl border text-base font-medium ${hour === h ? on : off}`}
            >
              {h}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Minuty">
          {MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minute === m}
              onClick={() => setTime(`${pad(hour)}:${pad(m)}`)}
              className={`min-h-11 rounded-xl border text-base font-medium ${minute === m ? on : off}`}
            >
              :{pad(m)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          Inna godzina
          <input type="time" step={SLOT_MIN * 60} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={`${input} h-11`} />
        </label>
      </fieldset>

      {services.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Usługa</legend>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <button key={s.id} type="button" aria-pressed={serviceId === s.id} onClick={() => pickService(s)} className={`${chip} ${serviceId === s.id ? on : off}`}>
                {s.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Czas trwania: {formatDuration(duration)}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Krócej" onClick={() => setDuration((d) => Math.max(DURATION_MIN, d - SLOT_MIN))} className={`${chip} ${off}`}>
            −
          </button>
          {DURATION_PRESETS.map((d) => (
            <button key={d} type="button" aria-pressed={duration === d} onClick={() => setDuration(d)} className={`${chip} ${duration === d ? on : off}`}>
              {formatDuration(d)}
            </button>
          ))}
          <button type="button" aria-label="Dłużej" onClick={() => setDuration((d) => Math.min(DURATION_MAX, d + SLOT_MIN))} className={`${chip} ${off}`}>
            +
          </button>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="appointment-note" className="text-sm font-medium">
          Notatka (opcjonalnie)
        </label>
        <textarea
          id="appointment-note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-xl border border-foreground/20 bg-background px-4 py-3 text-base"
        />
      </div>

      {state.conflicts && state.conflicts.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-500/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
          <p className="font-semibold">Nakłada się na:</p>
          <ul className="list-disc pl-4">
            {state.conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <SubmitButton name="confirm" value="1" variant="secondary" pendingText="Zapisywanie…">
            Zapisz mimo to
          </SubmitButton>
        </div>
      )}
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">{initial.id ? "Zapisz zmiany" : "Zapisz termin"}</SubmitButton>
      <Link href={cancelHref} className={buttonStyles.secondary}>
        Anuluj
      </Link>
    </form>
  );
}
