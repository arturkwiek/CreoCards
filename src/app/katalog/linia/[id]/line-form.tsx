"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import type { LineFormValues } from "@/lib/catalog/form";
import { BRAND_MAX, LINE_MAX } from "@/lib/catalog/values";
import { saveLine, type LineFormState } from "../../actions";
import { RatioPicker } from "../../ratio-picker";

/** Edycja marki/linii i jej domyślnej proporcji utleniacza (właścicielka). */
export function LineForm({ id, initial }: { id: string; initial: LineFormValues }) {
  const [state, action] = useActionState<LineFormState, FormData>(saveLine, {});
  const [values, setValues] = useState(initial);
  const errors = state.errors ?? {};
  const set = <K extends keyof LineFormValues>(key: K, value: string) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Marka"
          id="line-brand"
          name="brand"
          autoComplete="off"
          maxLength={BRAND_MAX}
          value={values.brand}
          onChange={(e) => set("brand", e.target.value)}
        />
        {errors.brand && <p className="text-sm text-red-700 dark:text-red-400">{errors.brand}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Linia (opcjonalnie)"
          id="line-name"
          name="name"
          autoComplete="off"
          maxLength={LINE_MAX}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
        />
        {errors.name && <p className="text-sm text-red-700 dark:text-red-400">{errors.name}</p>}
      </div>
      <RatioPicker
        name="default_ratio"
        label="Domyślna proporcja utleniacza"
        emptyLabel="Brak"
        value={values.default_ratio}
        onChange={(v) => set("default_ratio", v)}
        error={errors.default_ratio}
      />
      <p className="text-sm text-foreground/60">
        Proporcja podpowiada się przy wszystkich produktach linii, które nie mają własnej.
      </p>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">Zapisz linię</SubmitButton>
      <Link href="/katalog" className={buttonStyles.secondary}>
        Anuluj
      </Link>
    </form>
  );
}
