"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { deleteVisit } from "../actions";

/** Usunięcie wizyty (miękkie) z potwierdzeniem – tylko dla właścicielki. */
export function DeleteVisitButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonStyles.danger}>
        Usuń wizytę
      </button>
    );
  }

  return (
    <form action={deleteVisit} className="flex flex-col gap-2 rounded-xl border border-red-600/40 p-4">
      <p className="text-sm">Usunąć wizytę z historii klientki? Dane zostaną zachowane w bazie.</p>
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
