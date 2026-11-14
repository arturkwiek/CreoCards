"use client";

import { useActionState } from "react";
import { setPassword, type FormState } from "@/lib/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

export function SetPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(setPassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="Nowe hasło"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
      />
      <TextField
        label="Powtórz hasło"
        id="confirmation"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
      />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">Zapisz hasło</SubmitButton>
    </form>
  );
}
