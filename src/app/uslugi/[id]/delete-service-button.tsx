"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { deleteService } from "../actions";

/** Usunięcie usługi z listy (miękkie) – zapisane wizyty zachowują jej nazwę. */
export function DeleteServiceButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonStyles.danger}>
        Usuń z listy
      </button>
    );
  }

  return (
    <form action={deleteService} className="flex flex-col gap-2 rounded-xl border border-red-600/40 p-4">
      <p className="text-sm">Usunąć usługę z listy? Zapisane wizyty zachowają jej nazwę.</p>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="danger" pendingText="Usuwanie…">
        Tak, usuń
      </SubmitButton>
      <button type="button" onClick={() => setConfirming(false)} className={buttonStyles.secondary}>
        Anuluj
      </button>
    </form>
  );
}
