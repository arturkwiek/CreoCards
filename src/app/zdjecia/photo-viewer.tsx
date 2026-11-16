"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buttonStyles } from "@/components/styles";
import { deletePhoto, getPhotoUrl } from "./actions";
import type { PhotoThumb } from "./data";

/** Pełne zdjęcie na całym ekranie: link tworzony przy otwarciu (ważny 5 min); opcjonalnie „Usuń do kosza”. */
export function PhotoViewer({ photo, canDelete, onClose }: { photo: PhotoThumb; canDelete: boolean; onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getPhotoUrl(photo.id).then((u) => {
      if (!active) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [photo.id, onClose]);

  function remove() {
    const fd = new FormData();
    fd.set("id", photo.id);
    startTransition(async () => {
      const result = await deletePhoto(fd);
      if (result.error) setError(result.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Zdjęcie" className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <div className="flex justify-end p-3">
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium">
          Zamknij
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- podpisany link, bez optymalizacji Next
          <img src={url} alt="Zdjęcie z wizyty" className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-white/70">{failed ? "Nie udało się otworzyć zdjęcia." : "Ładowanie…"}</p>
        )}
      </div>
      {canDelete && (
        <div className="flex flex-col gap-2 p-4">
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className={`${buttonStyles.secondary} border-white/30 bg-transparent text-white`}>
              Usuń do kosza
            </button>
          ) : (
            <>
              <p className="text-sm">Przenieść zdjęcie do kosza? Właścicielka może je przywrócić.</p>
              <button type="button" disabled={pending} onClick={remove} className={`${buttonStyles.primary} bg-red-600`}>
                {pending ? "Usuwanie…" : "Tak, do kosza"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={`${buttonStyles.secondary} border-white/30 bg-transparent text-white`}>
                Anuluj
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
