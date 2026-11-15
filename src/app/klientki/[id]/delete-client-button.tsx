"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { deleteClient } from "../actions";

/** Usunięcie klientki (miękkie) z potwierdzeniem – tylko dla właścicielki. */
export function DeleteClientButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonStyles.danger}>
        Usuń klientkę
      </button>
    );
  }

  return (
    <form action={deleteClient} className="flex flex-col gap-2 rounded-xl border border-red-600/40 p-4">
      <p className="text-sm">Usunąć klientkę z listy? Historia zostanie zachowana w bazie.</p>
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
