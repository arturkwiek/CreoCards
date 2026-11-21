"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { deleteAppointment } from "../actions";

/** Termin do kosza (miękko) z potwierdzeniem. */
export function DeleteAppointmentButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonStyles.danger}>
        Do kosza
      </button>
    );
  }

  return (
    <form action={deleteAppointment} className="flex flex-col gap-2 rounded-xl border border-red-600/40 p-4">
      <p className="text-sm">Usunąć termin z grafiku? Właścicielka może go przywrócić z kosza. Odwołany termin lepiej oznaczyć „Odwołana”.</p>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="danger" pendingText="Usuwanie…">
        Tak, do kosza
      </SubmitButton>
      <button type="button" onClick={() => setConfirming(false)} className={buttonStyles.secondary}>
        Anuluj
      </button>
    </form>
  );
}
