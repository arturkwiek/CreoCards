"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/styles";
import { PhotoError, processPhoto } from "@/lib/photos/process";
import { consentStep, PHOTO_BUCKET } from "@/lib/photos/photo";
import { createClient } from "@/lib/supabase/client";
import { addPhoto, preparePhotoUpload } from "./actions";
import type { PhotoThumb } from "./data";
import { PhotoViewer } from "./photo-viewer";

type Job = { key: number; name: string; step: 0 | 1 | 2 | 3; error?: string; file: File; showsFace: boolean };

const STEPS = ["Przygotowanie…", "Wysyłanie…", "Zapisywanie…", "Gotowe"];

/** Zdjęcia wizyty: miniatury, dodawanie (aparat / galeria), ostrzeżenie o zgodzie, podgląd i kosz. */
export function PhotoSection({
  visitId,
  photos,
  canAdd,
  photoConsentAt,
  justSaved = false,
}: {
  visitId: string;
  photos: PhotoThumb[];
  canAdd: boolean;
  photoConsentAt: string | null;
  justSaved?: boolean;
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [pending, setPending] = useState<File[] | null>(null);
  const [confirmFace, setConfirmFace] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState<PhotoThumb | null>(null);
  const keyRef = useRef(0);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (justSaved) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [justSaved]);

  const update = (key: number, patch: Partial<Job>) =>
    setJobs((list) => list.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  async function run(job: Job) {
    update(job.key, { step: 0, error: undefined });
    try {
      const processed = await processPhoto(job.file);
      const prepared = await preparePhotoUpload(visitId, processed.mime);
      if ("error" in prepared) throw new PhotoError(prepared.error);
      update(job.key, { step: 1 });
      const storage = createClient().storage.from(PHOTO_BUCKET);
      for (const [path, blob] of [
        [prepared.path, processed.full],
        [prepared.thumb, processed.thumb],
      ] as const) {
        const { error } = await storage.upload(path, blob, { contentType: processed.mime, upsert: false, cacheControl: "3600" });
        if (error) throw new PhotoError("Nie udało się wysłać zdjęcia – sprawdź internet i ponów.");
      }
      update(job.key, { step: 2 });
      const saved = await addPhoto({ visitId, id: prepared.id, mime: processed.mime, showsFace: job.showsFace });
      if (!saved.ok) throw new PhotoError(saved.error);
      update(job.key, { step: 3 });
      return true;
    } catch (e) {
      update(job.key, { error: e instanceof PhotoError ? e.message : "Nie udało się dodać zdjęcia. Ponów." });
      return false;
    }
  }

  async function start(files: File[], showsFace: boolean) {
    setPending(null);
    setConfirmFace(false);
    const created = files.map((file) => ({ key: ++keyRef.current, name: file.name, step: 0 as const, file, showsFace }));
    setJobs((list) => [...list.filter((j) => !j.error && j.step !== 3), ...created]);
    let any = false;
    for (const job of created) any = (await run(job)) || any;
    if (any) router.refresh();
  }

  async function retry(job: Job) {
    if (await run(job)) router.refresh();
  }

  function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (files.length === 0) return;
    if (consentStep(photoConsentAt) === "ask-face") setPending(files);
    else void start(files, true);
  }

  return (
    <section ref={sectionRef} className="flex flex-col gap-3" aria-label="Zdjęcia">
      <h2 className="text-lg font-semibold">Zdjęcia</h2>
      {justSaved && canAdd && photos.length === 0 && (
        <p role="status" className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          Wizyta zapisana – dodaj zdjęcia fryzury.
        </p>
      )}

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(p)}
                className="relative block aspect-square w-full overflow-hidden rounded-lg bg-foreground/5"
                aria-label="Otwórz zdjęcie"
              >
                {p.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- podpisany link, bez optymalizacji Next
                  <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
                {p.showsFace && !photoConsentAt && (
                  <span className="absolute bottom-1 left-1 rounded bg-amber-500 px-1.5 text-xs font-medium text-white">
                    bez zgody
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !justSaved && <p className="text-sm text-foreground/60">Brak zdjęć.</p>
      )}

      {jobs.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {jobs.map((j) => (
            <li key={j.key} className="rounded-xl border border-foreground/10 px-3 py-2 text-sm">
              {j.error ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-red-700 dark:text-red-400">{j.error}</span>
                  <button type="button" onClick={() => void retry(j)} className="shrink-0 font-medium text-brand">
                    Ponów
                  </button>
                </div>
              ) : (
                <>
                  <span>{STEPS[j.step]}</span>
                  <div className="mt-1 h-1.5 rounded-full bg-foreground/10">
                    <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${((j.step + 1) / 4) * 100}%` }} />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <div role="alertdialog" aria-labelledby="consent-title" className="flex flex-col gap-2 rounded-xl border border-amber-500/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
          <p id="consent-title" className="font-semibold">Klientka nie ma zgody na zdjęcia</p>
          {!confirmFace ? (
            <>
              <p className="text-sm">Zdjęcie bez twarzy (np. tył głowy, pasemka) możesz dodać zawsze.</p>
              <button type="button" onClick={() => void start(pending, false)} className={buttonStyles.primary}>
                Bez twarzy (np. tył głowy)
              </button>
              <button type="button" onClick={() => setConfirmFace(true)} className={buttonStyles.secondary}>
                Z twarzą
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Zdjęcie z twarzą bez zgody trafi na listę „Zdjęcia bez zgody” u właścicielki. Najlepiej dopisz zgodę w danych klientki.
              </p>
              <button type="button" onClick={() => void start(pending, true)} className={buttonStyles.danger}>
                Dodaj mimo braku zgody
              </button>
            </>
          )}
          <button type="button" onClick={() => setPending(null)} className={`${buttonStyles.secondary} h-10 text-sm`}>
            Anuluj
          </button>
        </div>
      )}

      {canAdd && !pending && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className={buttonStyles.primary}>
            Zrób zdjęcie
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className={buttonStyles.secondary}>
            Z galerii
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
      )}

      {open && <PhotoViewer photo={open} canDelete={canAdd} onClose={close} />}
    </section>
  );
}
