"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { previewImport, runImport, type ImportPreviewState, type ImportRunState } from "../actions";

function Summary({ result }: { result: NonNullable<ImportRunState["result"]> }) {
  return (
    <div className="flex flex-col gap-3">
      <FormMessage
        success={`Zaimportowano. Nowe linie: ${result.lines_created}, zmienione linie: ${result.lines_updated}, nowe produkty: ${result.products_created}, zmienione produkty: ${result.products_updated}.`}
      />
      <Link href="/katalog" className={buttonStyles.primary}>
        Przejdź do katalogu
      </Link>
    </div>
  );
}

function ConfirmImport({ preview }: { preview: ImportPreviewState }) {
  const [state, action] = useActionState<ImportRunState, FormData>(runImport, {});
  if (state.result) return <Summary result={state.result} />;

  const plan = preview.plan!;
  const changes = plan.newProducts + plan.updatedProducts + plan.newLines.length + plan.updatedLines.length;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="csv" value={preview.csv ?? ""} />
      <input type="hidden" name="file_name" value={preview.fileName ?? ""} />

      <section className="flex flex-col gap-2 rounded-xl bg-foreground/5 px-4 py-3 text-sm">
        <p className="font-semibold">Podgląd{preview.fileName ? `: ${preview.fileName}` : ""}</p>
        <ul className="flex flex-col gap-1">
          <li>Poprawne wiersze: {preview.count}</li>
          <li>Nowe produkty: {plan.newProducts}</li>
          <li>Zmienione produkty: {plan.updatedProducts}</li>
          <li>Bez zmian: {plan.unchangedProducts}</li>
        </ul>
        {plan.newLines.length > 0 && (
          <div>
            <p className="font-medium">Nowe marki / linie:</p>
            <ul className="list-disc pl-5">
              {plan.newLines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
        {plan.updatedLines.length > 0 && (
          <div>
            <p className="font-medium">Zmiana domyślnej proporcji:</p>
            <ul className="list-disc pl-5">
              {plan.updatedLines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
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
            {preview.errors.length > 30 && <li>… i {preview.errors.length - 30} kolejnych.</li>}
          </ul>
        </div>
      )}

      <FormMessage error={state.error} />
      {changes > 0 ? (
        <SubmitButton pendingText="Importowanie…">Importuj</SubmitButton>
      ) : (
        <p className="text-sm text-foreground/70">Katalog jest już aktualny – nic do zaimportowania.</p>
      )}
    </form>
  );
}

/** Import CSV (właścicielka): wybór pliku → podgląd zmian → „Importuj”. */
export function ImportForm() {
  const [preview, action] = useActionState<ImportPreviewState, FormData>(previewImport, {});

  return (
    <div className="flex flex-col gap-5">
      <form action={action} className="flex flex-col gap-3">
        <label htmlFor="import-file" className="text-sm font-medium">
          Plik CSV
        </label>
        <input
          id="import-file"
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
      {/* key: nowy podgląd = nowy formularz potwierdzenia. */}
      {preview.plan && <ConfirmImport key={`${preview.fileName}-${preview.csv?.length}`} preview={preview} />}
    </div>
  );
}
