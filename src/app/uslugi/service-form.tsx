"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { EMPTY_SERVICE_FORM, type ServiceFormValues } from "@/lib/services/form";
import { SERVICE_NAME_MAX } from "@/lib/services/import";
import { saveService, type ServiceFormState } from "./actions";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-red-700 dark:text-red-400">{message}</p> : null;
}

/** Dodawanie i edycja usługi (właścicielka). */
export function ServiceForm({ id, initial = EMPTY_SERVICE_FORM }: { id?: string; initial?: ServiceFormValues }) {
  const [state, action] = useActionState<ServiceFormState, FormData>(saveService, {});
  const [values, setValues] = useState(initial);
  const errors = state.errors ?? {};
  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Usługa"
          id="service-name"
          name="name"
          autoComplete="off"
          maxLength={SERVICE_NAME_MAX}
          autoFocus={!id}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <FieldError message={errors.name} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Cena od (zł)"
            id="service-from"
            name="price_from"
            inputMode="decimal"
            autoComplete="off"
            value={values.price_from}
            onChange={(e) => set("price_from", e.target.value)}
          />
          <FieldError message={errors.price_from} />
        </div>
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Cena do (zł)"
            id="service-to"
            name="price_to"
            inputMode="decimal"
            autoComplete="off"
            value={values.price_to}
            onChange={(e) => set("price_to", e.target.value)}
          />
          <FieldError message={errors.price_to} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Czas (min)"
          id="service-duration"
          name="duration_min"
          inputMode="numeric"
          autoComplete="off"
          value={values.duration_min}
          onChange={(e) => set("duration_min", e.target.value)}
        />
        <FieldError message={errors.duration_min} />
      </div>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input
          type="checkbox"
          name="with_color"
          checked={values.with_color}
          onChange={(e) => set("with_color", e.target.checked)}
          className="h-5 w-5 accent-brand"
        />
        Z farbą (przy wizycie od razu otwiera recepturę)
      </label>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">{id ? "Zapisz zmiany" : "Zapisz usługę"}</SubmitButton>
      <Link href="/uslugi" className={buttonStyles.secondary}>
        Anuluj
      </Link>
    </form>
  );
}
