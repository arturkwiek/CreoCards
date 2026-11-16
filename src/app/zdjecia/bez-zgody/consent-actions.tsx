"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonStyles } from "@/components/styles";
import { addPhotoConsent, deletePhoto } from "../actions";

/** „Dopisz zgodę” (dla klientki, dzisiejsza data) i „Usuń do kosza” na liście zdjęć bez zgody. */
export function ConsentActions({ photoId, clientId }: { photoId: string; clientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  function run(action: (fd: FormData) => Promise<{ error?: string }>, fd: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await action(fd);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const consent = () => {
    const fd = new FormData();
    fd.set("client_id", clientId);
    run(addPhotoConsent, fd);
  };
  const remove = () => {
    const fd = new FormData();
    fd.set("id", photoId);
    run(deletePhoto, fd);
  };

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} onClick={consent} className={`${buttonStyles.primary} h-10 text-sm`}>
            Dopisz zgodę
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirming(true)} className={`${buttonStyles.danger} h-10 text-sm`}>
            Usuń do kosza
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm">Przenieść zdjęcie do kosza?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={remove} className={`${buttonStyles.danger} h-10 text-sm`}>
              {pending ? "Usuwanie…" : "Tak, do kosza"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={`${buttonStyles.secondary} h-10 text-sm`}>
              Anuluj
            </button>
          </div>
        </>
      )}
    </div>
  );
}
