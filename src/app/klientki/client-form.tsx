"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import {
  CLIENT_NAME_MAX,
  CLIENT_TEXT_MAX,
  EMPTY_CLIENT_FORM,
  warsawDate,
  type AllergyStatus,
  type ClientFormValues,
} from "@/lib/clients/form";
import { findClientsWithPhone, saveClient, type ClientFormState, type PhoneMatch } from "./actions";

const ALLERGY_OPTIONS: { value: AllergyStatus; label: string; selected: string }[] = [
  { value: "none", label: "Brak znanych alergii", selected: "border-brand bg-brand text-white" },
  { value: "has", label: "Są alergie / uwagi", selected: "border-red-600 bg-red-600 text-white" },
];

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  );
}

const textareaClass =
  "rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2";

/** Formularz klientki: dodawanie (bez id) i edycja. Pola obowiązkowe na górze, reszta w „Więcej”. */
export function ClientForm({
  id,
  initial = EMPTY_CLIENT_FORM,
  cancelHref,
}: {
  id?: string;
  initial?: ClientFormValues;
  cancelHref: string;
}) {
  const [state, action] = useActionState<ClientFormState, FormData>(saveClient, {});
  const [values, setValues] = useState<ClientFormValues>(initial);
  const [duplicates, setDuplicates] = useState<PhoneMatch[]>([]);
  const [, startTransition] = useTransition();
  const errors = state.errors ?? {};

  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function checkPhone() {
    const phone = values.phone;
    startTransition(async () => {
      setDuplicates(phone.trim() ? await findClientsWithPhone(phone, id) : []);
    });
  }

  const optionalOpen = Boolean(
    initial.email ||
      initial.note ||
      initial.rodo_consent ||
      initial.notifications_consent ||
      initial.photo_consent_date ||
      errors.email ||
      errors.note ||
      errors.photo_consent_date,
  );

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {id && <input type="hidden" name="id" value={id} />}

      <div className="flex flex-col gap-1.5">
        <TextField
          label="Imię i nazwisko"
          id="client-name"
          name="full_name"
          autoComplete="off"
          autoCapitalize="words"
          maxLength={CLIENT_NAME_MAX}
          autoFocus={!id}
          value={values.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          aria-invalid={Boolean(errors.full_name)}
          aria-describedby="client-name-error"
        />
        <FieldError id="client-name-error" message={errors.full_name} />
      </div>

      <div className="flex flex-col gap-1.5">
        <TextField
          label="Telefon"
          id="client-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="600 123 456"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          onBlur={checkPhone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby="client-phone-error"
        />
        <FieldError id="client-phone-error" message={errors.phone} />
        {duplicates.length > 0 && (
          <div
            role="status"
            className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            Ten numer ma już:{" "}
            {duplicates.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ", "}
                <Link href={`/klientki/${d.id}`} className="font-medium underline">
                  {d.full_name}
                </Link>
              </span>
            ))}
            . Możesz mimo to zapisać tę klientkę.
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby="client-allergy-error">
        <legend className="mb-1.5 text-sm font-medium">Alergie / uwagi zdrowotne</legend>
        <input type="hidden" name="allergy_status" value={values.allergy_status} />
        <div className="grid grid-cols-2 gap-2">
          {ALLERGY_OPTIONS.map((opt) => {
            const selected = values.allergy_status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => set("allergy_status", opt.value)}
                className={`min-h-12 rounded-xl border px-3 py-2 text-base font-medium ${
                  selected ? opt.selected : "border-foreground/20 text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <FieldError id="client-allergy-error" message={errors.allergy_status} />
        {values.allergy_status === "has" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-allergies" className="text-sm font-medium">
              Opis (opcjonalnie)
            </label>
            <textarea
              id="client-allergies"
              name="allergies"
              rows={3}
              maxLength={CLIENT_TEXT_MAX}
              placeholder="np. PPD, lateks, wrażliwa skóra głowy"
              value={values.allergies}
              onChange={(e) => set("allergies", e.target.value)}
              className={`${textareaClass} border-red-600/40 focus:border-red-600 focus:ring-red-600/30`}
            />
            <FieldError id="client-allergies-error" message={errors.allergies} />
          </div>
        )}
      </fieldset>

      <details open={optionalOpen} className="rounded-xl border border-foreground/10 p-4">
        <summary className="cursor-pointer text-sm font-medium">Więcej: e-mail, notatka, zgody (także na zdjęcia)</summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <TextField
              label="E-mail (opcjonalnie)"
              id="client-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby="client-email-error"
            />
            <FieldError id="client-email-error" message={errors.email} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-note" className="text-sm font-medium">
              Notatka (profil włosa, preferencje)
            </label>
            <textarea
              id="client-note"
              name="note"
              rows={3}
              maxLength={CLIENT_TEXT_MAX}
              value={values.note}
              onChange={(e) => set("note", e.target.value)}
              className={`${textareaClass} border-foreground/20 focus:border-brand focus:ring-brand/30`}
            />
            <FieldError id="client-note-error" message={errors.note} />
          </div>
          <label className="flex min-h-12 items-center gap-3 text-base">
            <input
              type="checkbox"
              name="rodo_consent"
              checked={values.rodo_consent}
              onChange={(e) => set("rodo_consent", e.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            Zgoda na przetwarzanie danych (RODO)
          </label>
          <label className="flex min-h-12 items-center gap-3 text-base">
            <input
              type="checkbox"
              name="notifications_consent"
              checked={values.notifications_consent}
              onChange={(e) => set("notifications_consent", e.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            Zgoda na powiadomienia (SMS / e-mail)
          </label>
          <fieldset className="flex flex-col gap-2" aria-describedby="client-photo-consent-error">
            <legend className="mb-1.5 text-sm font-medium">Zgoda na zdjęcia (wizerunek)</legend>
            <input type="hidden" name="photo_consent_date" value={values.photo_consent_date} />
            {values.photo_consent_date ? (
              <>
                <label htmlFor="client-photo-consent" className="text-sm text-foreground/70">
                  Data zgody
                </label>
                <input
                  id="client-photo-consent"
                  type="date"
                  max={warsawDate(new Date())}
                  value={values.photo_consent_date}
                  onChange={(e) => set("photo_consent_date", e.target.value)}
                  className={`${textareaClass} h-12 border-foreground/20 py-0 focus:border-brand focus:ring-brand/30`}
                />
                <button
                  type="button"
                  onClick={() => set("photo_consent_date", "")}
                  className={`${buttonStyles.secondary} h-10 text-sm`}
                >
                  Wycofaj zgodę
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground/70">
                  Brak zgody – zdjęcia bez twarzy (np. tył głowy) można robić zawsze.
                </p>
                <button
                  type="button"
                  onClick={() => set("photo_consent_date", warsawDate(new Date()))}
                  className={`${buttonStyles.secondary} h-10 text-sm`}
                >
                  Zgoda udzielona dziś
                </button>
              </>
            )}
            <FieldError id="client-photo-consent-error" message={errors.photo_consent_date} />
          </fieldset>
        </div>
      </details>

      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">{id ? "Zapisz zmiany" : "Zapisz klientkę"}</SubmitButton>
      <Link href={cancelHref} className={buttonStyles.secondary}>
        Anuluj
      </Link>
    </form>
  );
}
