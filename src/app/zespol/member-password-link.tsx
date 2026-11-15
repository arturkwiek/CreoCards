"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { createPasswordLink, type InviteState } from "./actions";
import { InviteLinkBox } from "./invite-link-box";

/** „Utwórz link do ustawienia hasła” przy osobie z zespołu (tylko dla właścicielki). */
export function MemberPasswordLink({ id }: { id: string }) {
  const [state, action] = useActionState<InviteState, FormData>(createPasswordLink, {});

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
    </div>
  );
}
