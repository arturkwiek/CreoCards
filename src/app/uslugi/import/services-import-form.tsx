"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import {
  previewServicesImport,
  runServicesImport,
  type ServicesPreviewState,
  type ServicesRunState,
} from "../actions";

function ConfirmImport({ preview }: { preview: ServicesPreviewState }) {
  const [state, action] = useActionState<ServicesRunState, FormData>(runServicesImport, {});
  if (state.result) {
    return (
      <div className="flex flex-col gap-3">
        <FormMessage success={`Zaimportowano. Nowe usługi: ${state.result.created}, zmienione: ${state.result.updated}.`} />
        <Link href="/uslugi" className={buttonStyles.primary}>
          Przejdź do usług
        </Link>
      </div>
    );
  }
  const plan = preview.plan!;
  const changes = plan.created.length + plan.updated.length;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="csv" value={preview.csv ?? ""} />
      <input type="hidden" name="file_name" value={preview.fileName ?? ""} />
      <section className="flex flex-col gap-2 rounded-xl bg-foreground/5 px-4 py-3 text-sm">
        <p className="font-semibold">Podgląd{preview.fileName ? `: ${preview.fileName}` : ""}</p>
        <ul className="flex flex-col gap-1">
          <li>Poprawne wiersze: {preview.count}</li>
          <li>Nowe usługi: {plan.created.length}</li>
          <li>Zmienione usługi: {plan.updated.length}</li>
          <li>Bez zmian: {plan.unchanged}</li>
        </ul>
        {plan.created.length > 0 && (
          <ul className="list-disc pl-5">
            {plan.created.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>
      {preview.warnings && preview.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {preview.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {preview.errors && preview.errors.length > 0 && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Wiersze z błędami zostaną pominięte ({preview.errors.length}):</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {preview.errors.slice(0, 30).map((e) => (
              <li key={e.row}>
                Wiersz {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormMessage error={state.error} />
      {changes > 0 ? (
        <SubmitButton pendingText="Importowanie…">Importuj</SubmitButton>
      ) : (
        <p className="text-sm text-foreground/70">Lista usług jest już aktualna – nic do zaimportowania.</p>
      )}
    </form>
  );
}

/** Import usług z CSV (właścicielka): plik → podgląd → „Importuj”. */
export function ServicesImportForm() {
  const [preview, action] = useActionState<ServicesPreviewState, FormData>(previewServicesImport, {});
  return (
    <div className="flex flex-col gap-5">
      <form action={action} className="flex flex-col gap-3">
        <label htmlFor="services-file" className="text-sm font-medium">
          Plik CSV
        </label>
        <input
          id="services-file"
          name="file"
          type="file"
          accept=".csv,text/csv,text/plain"
          required
          className="rounded-xl border border-foreground/20 bg-background px-3 py-3 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2"
        />
        <SubmitButton variant="secondary" pendingText="Sprawdzanie…">
          Sprawdź plik
        </SubmitButton>
      </form>
      <FormMessage error={preview.fatal} />
      {preview.plan && <ConfirmImport key={`${preview.fileName}-${preview.csv?.length}`} preview={preview} />}
    </div>
  );
}
