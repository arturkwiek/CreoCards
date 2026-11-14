"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { ROLE_LABELS, type UserRole } from "@/lib/validation";
import { inviteMember } from "./actions";

const ROLES: UserRole[] = ["apprentice", "owner"];

export function InviteForm() {
  const [state, action] = useActionState<FormState, FormData>(inviteMember, {});
  const [role, setRole] = useState<UserRole>("apprentice");

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="E-mail"
        id="invite-email"
        name="email"
        type="email"
        autoComplete="off"
        inputMode="email"
        required
      />
      <TextField label="Imię (opcjonalnie)" id="invite-name" name="full_name" autoComplete="off" />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Rola</legend>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={`h-12 rounded-xl border text-base font-medium ${
                role === r
                  ? "border-brand bg-brand text-white"
                  : "border-foreground/20 text-foreground"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>

      <FormMessage error={state.error} success={state.success} />
      <SubmitButton pendingText="Wysyłanie…">Wyślij zaproszenie</SubmitButton>
    </form>
  );
}
