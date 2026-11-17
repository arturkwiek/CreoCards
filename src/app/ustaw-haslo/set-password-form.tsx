"use client";

import Link from "next/link";
import { useActionState } from "react";
import { notMyAccount, setPassword, type FormState } from "@/lib/auth/actions";
import type { AccountIdentity } from "@/lib/auth/login";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

export function SetPasswordForm({ identity }: { identity: AccountIdentity }) {
  const [state, action] = useActionState<FormState, FormData>(setPassword, {});

  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage success={state.success} />
        <Link href="/" prefetch={false} className={buttonStyles.primary}>
          Przejdź do aplikacji
        </Link>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        {/* Login przed polami hasła – menedżer haseł w telefonie zapisze hasło razem z loginem. */}
        <TextField
          label={identity.kind === "login" ? "Login" : "E-mail"}
          id="set-password-username"
          name="username"
          type="text"
          autoComplete="username"
          value={identity.value}
          readOnly
          className="h-12 rounded-xl border border-foreground/10 bg-foreground/5 px-4 text-base text-foreground/80 outline-none"
        />
        <TextField
          label="Nowe hasło"
          id="set-password-new"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <TextField
          label="Powtórz hasło"
          id="set-password-confirm"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <FormMessage error={state.error} />
        <SubmitButton pendingText="Zapisywanie…">Zapisz hasło</SubmitButton>
      </form>
      <form action={notMyAccount}>
        <button type="submit" className="w-full text-center text-sm text-brand underline-offset-4 hover:underline">
          To nie moje konto
        </button>
      </form>
    </>
  );
}
