"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { cancelInvitation, createInviteLink, type InviteState } from "./actions";
import { InviteLinkBox } from "./invite-link-box";

export function PendingInvitationActions({ id }: { id: string }) {
  const [state, action] = useActionState<InviteState, FormData>(createInviteLink, {});

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton variant="secondary" pendingText="Tworzenie linku…">
          Kopiuj link zaproszenia
        </SubmitButton>
      </form>
      <FormMessage error={state.error} />
      {state.link && <InviteLinkBox link={state.link} />}
      <form action={cancelInvitation}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton variant="danger">Anuluj zaproszenie</SubmitButton>
      </form>
    </div>
  );
}
