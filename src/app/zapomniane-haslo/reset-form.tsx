"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="E-mail"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
      />
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton pendingText="Wysyłanie…">Wyślij link</SubmitButton>
    </form>
  );
}
