"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { ROLE_LABELS, type UserRole } from "@/lib/validation";
import { inviteMember, type InviteState } from "./actions";
import { InviteLinkBox } from "./invite-link-box";

const ROLES: UserRole[] = ["apprentice", "owner"];

/** emailEnabled = false (brak własnego SMTP): tylko link zaproszenia. */
export function InviteForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember, {});
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
      {state.link && <InviteLinkBox link={state.link} />}

      {emailEnabled && (
        <SubmitButton name="delivery" value="email" pendingText="Wysyłanie…">
          Wyślij zaproszenie e-mailem
        </SubmitButton>
      )}
      <SubmitButton
        name="delivery"
        value="link"
        variant={emailEnabled ? "secondary" : "primary"}
        pendingText="Tworzenie linku…"
      >
        Utwórz link zaproszenia
      </SubmitButton>
    </form>
  );
}
