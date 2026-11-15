"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { LOGIN_RULES } from "@/lib/auth/login";
import { ROLE_LABELS, type UserRole } from "@/lib/validation";
import { addMember, type AddMemberState } from "./actions";
import { InviteLinkBox } from "./invite-link-box";
import { TempPasswordBox } from "./temp-password-box";

const ROLES: UserRole[] = ["apprentice", "owner"];

/**
 * Nowa osoba: login + rola, e-mail opcjonalny. Domyślnie link do ustawienia hasła;
 * hasło tymczasowe jako opcja zapasowa (tylko konto bez e-maila).
 * emailEnabled = false (brak własnego SMTP): bez wysyłki e-maili.
 */
export function InviteForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [state, action] = useActionState<AddMemberState, FormData>(addMember, {});
  const [role, setRole] = useState<UserRole>("apprentice");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const hasEmail = email.trim() !== "";

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField label="Imię (opcjonalnie)" id="invite-name" name="full_name" autoComplete="off" />
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Login"
          id="invite-login"
          name="login"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
          placeholder="np. ania"
          value={login}
          onChange={(e) => setLogin(e.target.value.toLowerCase())}
          required
        />
        <p className="text-xs text-foreground/60">{LOGIN_RULES}. Login służy do logowania.</p>
      </div>

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
                role === r ? "border-brand bg-brand text-white" : "border-foreground/20 text-foreground"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>

      <TextField
        label="E-mail (opcjonalnie)"
        id="invite-email"
        name="email"
        type="email"
        autoComplete="off"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <FormMessage error={state.error} success={state.success} />
      {state.link && <InviteLinkBox link={state.link} label="Link do ustawienia hasła" />}
      {state.tempPassword && <TempPasswordBox password={state.tempPassword} />}

      {hasEmail && emailEnabled && (
        <SubmitButton name="delivery" value="email" pendingText="Wysyłanie…">
          Wyślij zaproszenie e-mailem
        </SubmitButton>
      )}
      <SubmitButton
        name="delivery"
        value="link"
        variant={hasEmail && emailEnabled ? "secondary" : "primary"}
        pendingText="Tworzenie konta…"
      >
        Utwórz link do ustawienia hasła
      </SubmitButton>
      {!hasEmail && (
        <SubmitButton name="delivery" value="temp" variant="secondary" pendingText="Tworzenie konta…">
          Zamiast linku: ustaw hasło tymczasowe
        </SubmitButton>
      )}
    </form>
  );
}
