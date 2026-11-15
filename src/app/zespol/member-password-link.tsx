"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { createPasswordLink, setTemporaryPassword, type AddMemberState, type InviteState } from "./actions";
import { InviteLinkBox } from "./invite-link-box";
import { TempPasswordBox } from "./temp-password-box";

/**
 * Pierwsze hasło i reset przy osobie z zespołu (tylko dla właścicielki):
 * „Utwórz link do ustawienia hasła” (domyślnie) albo hasło tymczasowe (opcja zapasowa).
 */
export function MemberPasswordLink({ id }: { id: string }) {
  const [state, action] = useActionState<InviteState, FormData>(createPasswordLink, {});
  const [temp, tempAction] = useActionState<AddMemberState, FormData>(setTemporaryPassword, {});

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton variant="secondary" pendingText="Tworzenie linku…">
          Utwórz link do ustawienia hasła
        </SubmitButton>
      </form>
      <FormMessage error={state.error} />
      {state.link && <InviteLinkBox link={state.link} label="Link do ustawienia hasła" />}

      <details className="text-sm">
        <summary className="cursor-pointer text-foreground/60">Inna opcja: hasło tymczasowe</summary>
        <form action={tempAction} className="mt-2">
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="secondary" pendingText="Ustawianie…">
            Ustaw hasło tymczasowe
          </SubmitButton>
        </form>
      </details>
      <FormMessage error={temp.error} />
      {temp.tempPassword && <TempPasswordBox password={temp.tempPassword} />}
    </div>
  );
}
