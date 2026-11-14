"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/lib/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
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
      <TextField
        label="Hasło"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Logowanie…">Zaloguj się</SubmitButton>
    </form>
  );
}
