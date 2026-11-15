"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import type { FormState } from "@/lib/auth/actions";
import { saveOwnFullName } from "@/lib/profile/actions";
import { FULL_NAME_MAX_LENGTH } from "@/lib/profile/name";

/** Zachęta do uzupełnienia imienia (gdy konto powstało z zaproszenia bez imienia). */
export function NamePrompt() {
  const [state, action] = useActionState<FormState, FormData>(saveOwnFullName, {});

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-brand/40 bg-brand/5 p-4"
    >
      <div>
        <p className="font-medium">Uzupełnij swoje imię</p>
        <p className="text-sm text-foreground/70">
          Dzięki temu zespół zobaczy, kto zapisał wizytę lub recepturę.
        </p>
      </div>
      <TextField
        label="Imię"
        id="own-full-name"
        name="full_name"
        autoComplete="given-name"
        maxLength={FULL_NAME_MAX_LENGTH}
        required
      />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">Zapisz imię</SubmitButton>
    </form>
  );
}
