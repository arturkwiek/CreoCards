"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { restoreFromTrash, restoreVersion, type RestoreState, type TrashKind } from "./actions";

/** „Przywróć tę wersję” z potwierdzeniem (tylko właścicielka). */
export function RestoreVersionButton({ auditId, path }: { auditId: number; path: string }) {
  const [state, action] = useActionState<RestoreState, FormData>(restoreVersion, {});
  const [confirming, setConfirming] = useState(false);

  if (state.success) return <FormMessage success={state.success} />;
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${buttonStyles.secondary} h-10 text-sm`}>
        Przywróć tę wersję
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="audit_id" value={auditId} />
      <input type="hidden" name="path" value={path} />
      <p className="text-sm">Przywrócić stan sprzed tej zmiany? Obecny stan zostanie zapisany w historii.</p>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Przywracanie…" className="h-10 text-sm">
        Tak, przywróć
      </SubmitButton>
      <button type="button" onClick={() => setConfirming(false)} className={`${buttonStyles.secondary} h-10 text-sm`}>
        Anuluj
      </button>
    </form>
  );
}

/** „Przywróć” w koszu (tylko właścicielka). */
export function RestoreFromTrashButton({ kind, id }: { kind: TrashKind; id: string }) {
  const [state, action] = useActionState<RestoreState, FormData>(restoreFromTrash, {});
  if (state.success) return <FormMessage success={state.success} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <FormMessage error={state.error} />
      <SubmitButton variant="secondary" pendingText="Przywracanie…" className="h-10 text-sm">
        Przywróć
      </SubmitButton>
    </form>
  );
}
