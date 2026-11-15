"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { deleteProduct } from "../../actions";

/** Usunięcie produktu z katalogu (miękkie) z potwierdzeniem – tylko dla właścicielki. */
export function DeleteProductButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonStyles.danger}>
        Usuń z katalogu
      </button>
    );
  }

  return (
    <form action={deleteProduct} className="flex flex-col gap-2 rounded-xl border border-red-600/40 p-4">
      <p className="text-sm">Usunąć produkt z katalogu? Zniknie z listy, a jego dane zostaną zachowane w bazie.</p>
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
