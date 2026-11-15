"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { LOGIN_RULES } from "@/lib/auth/login";
import { setMemberLogin, type InviteState } from "./actions";

/** „Nadaj login” / „Zmień login” przy osobie z zespołu (tylko dla właścicielki). */
export function MemberLoginForm({ id, login }: { id: string; login: string | null }) {
  const [state, action] = useActionState<InviteState, FormData>(setMemberLogin, {});
  const [value, setValue] = useState(login ?? "");

  return (
    <details className="text-sm" open={Boolean(state.error)}>
      <summary className="cursor-pointer text-brand">{login ? "Zmień login" : "Nadaj login"}</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor={`login-${id}`} className="sr-only">
          Login
        </label>
        <input
          id={`login-${id}`}
          name="login"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          className="h-11 rounded-xl border border-foreground/20 bg-background px-3 text-base"
        />
        <p className="text-xs text-foreground/60">{LOGIN_RULES}.</p>
        <FormMessage error={state.error} success={state.success} />
        <SubmitButton variant="secondary" pendingText="Zapisywanie…">
          Zapisz login
        </SubmitButton>
      </form>
    </details>
  );
}
