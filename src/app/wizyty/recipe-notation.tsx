"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonStyles } from "@/components/styles";
import { formatNumber, formatRatio } from "@/lib/catalog/values";
import {
  NOTATION_ASSUMPTIONS,
  isUsable,
  notationToMixes,
  parseNotation,
  type NotationResult,
} from "@/lib/visits/notation";
import { ZONE_LABELS, oxidantGrams, suggestRatio, type DraftMix } from "@/lib/visits/recipe";
import type { VisitProduct } from "./visit-form";

export type InsertMode = "replace" | "append";
export type InsertedMix = DraftMix & { ratioGiven: boolean };

const EXAMPLE = "9.008, -10g, 8.36-10g, 8.000-10g, 8.21-10g/6%";

/**
 * „Wpisz lub podyktuj recepturę”: skrócony zapis (albo dyktowanie mikrofonem klawiatury) → podgląd → wstawienie
 * do formularza. Nic nie zapisuje się bez „Zapisz wizytę”.
 */
export function RecipeNotation({
  products,
  preferredBrands,
  hasItems,
  onInsert,
}: {
  products: VisitProduct[];
  preferredBrands: string[];
  hasItems: boolean;
  onInsert: (mixes: InsertedMix[], mode: InsertMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<NotationResult | null>(null);
  const [askMode, setAskMode] = useState(false);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const label = (id: string | null) => {
    const p = id ? byId.get(id) : undefined;
    return p ? [p.brand, p.shade].filter(Boolean).join(" ") : "";
  };
  const suggest = (items: DraftMix["items"]) => suggestRatio(items, byId);
  const ready = result ? notationToMixes(result.mixes, suggest) : [];
  const skippedCount = result
    ? result.mixes.reduce((n, m) => n + m.items.filter((i) => !isUsable(i)).length, 0)
    : 0;

  function recognize() {
    setAskMode(false);
    setResult(parseNotation(text, products, preferredBrands));
  }

  function choose(mixIndex: number, itemIndex: number, productId: string) {
    setResult((r) => {
      if (!r) return r;
      const mixes = r.mixes.map((m, mi) =>
        mi !== mixIndex ? m : { ...m, items: m.items.map((it, ii) => (ii !== itemIndex ? it : { ...it, productId })) },
      );
      return { ...r, mixes };
    });
  }

  function insert(mode: InsertMode) {
    onInsert(ready, mode);
    setOpen(false);
    setResult(null);
    setText("");
    setAskMode(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonStyles.secondary}>
        Wpisz lub podyktuj recepturę
      </button>
    );
  }

  return (
    <section aria-label="Wpisz lub podyktuj recepturę" className="flex flex-col gap-3 rounded-xl border border-brand/40 p-3">
      <label htmlFor="recipe-notation" className="text-sm font-medium">
        Receptura w skrócie
      </label>
      <textarea
        id="recipe-notation"
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        placeholder={EXAMPLE}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="rounded-xl border border-foreground/20 bg-background px-3 py-2 text-base outline-none focus:border-brand"
      />
      <p className="text-xs text-foreground/60">
        Odcień-gramy po przecinku, stężenie utleniacza na końcu (np. {EXAMPLE}). Każda linia to osobna mieszanka.
        <br />
        <strong>Dyktowanie:</strong> dotknij mikrofonu na klawiaturze (Gboard, Samsung) i mów, np. „dziewięć kropka zero
        zero osiem, dziesięć gram, … sześć procent”.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={recognize} disabled={!text.trim()} className={`${buttonStyles.primary} h-11`}>
          Rozpoznaj
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${buttonStyles.secondary} h-11`}>
          Zamknij
        </button>
      </div>

      {result && (
        <div className="flex flex-col gap-3" aria-label="Podgląd receptury" role="region">
          <h3 className="text-sm font-semibold">Podgląd – sprawdź przed wstawieniem</h3>
          {result.mixes.length === 0 ? (
            <p className="text-sm text-red-700 dark:text-red-400">Nie rozpoznano żadnej farby. Popraw tekst.</p>
          ) : (
            result.mixes.map((m, mi) => {
              const draft = notationToMixes([m], suggest)[0];
              return (
                <div key={mi} className="flex flex-col gap-1.5 rounded-xl bg-foreground/5 p-3 text-sm">
                  <p className="font-semibold">
                    Mieszanka {mi + 1} · {ZONE_LABELS[m.zone]}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {m.items.map((it, ii) => {
                      const usable = isUsable(it);
                      const brands = new Set(it.candidates.map((id) => byId.get(id)?.brand));
                      return (
                        <li key={ii} className={usable ? "" : "text-red-700 dark:text-red-400"}>
                          <span className="font-medium">{usable ? label(it.productId) : it.shade}</span>
                          {it.grams !== null && ` – ${formatNumber(it.grams)} g`}
                          {it.candidates.length > 1 && brands.size > 1 && (
                            <select
                              aria-label={`Produkt dla ${it.shade}`}
                              value={it.productId ?? ""}
                              onChange={(e) => choose(mi, ii, e.target.value)}
                              className="ml-2 rounded-lg border border-foreground/20 bg-background px-2 py-1 text-sm"
                            >
                              {it.candidates.map((id) => (
                                <option key={id} value={id}>
                                  {label(id)}
                                </option>
                              ))}
                            </select>
                          )}
                          {it.notes.map((n) => (
                            <span key={n} className="block text-xs text-amber-800 dark:text-amber-300">
                              {n}
                            </span>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                  <p>
                    {m.oxidant_percent === null
                      ? "Bez utleniacza"
                      : `Utleniacz ${formatNumber(m.oxidant_percent)}%` +
                        (draft?.ratio ? ` · proporcja ${formatRatio(draft.ratio)}${m.ratio === null ? " (z katalogu)" : ""}` : " · proporcja – wybierz w recepturze") +
                        (draft?.ratio ? ` · ${formatNumber(oxidantGrams(draft))} g utleniacza` : "")}
                    {m.processing_minutes !== null && ` · ${m.processing_minutes} min`}
                  </p>
                  {m.notes.map((n) => (
                    <p key={n} className="text-xs text-amber-800 dark:text-amber-300">
                      {n}
                    </p>
                  ))}
                </div>
              );
            })
          )}
          {result.skipped.length > 0 && (
            <p className="text-xs text-foreground/60">Pominięto: {result.skipped.join(", ")}</p>
          )}
          <div className="rounded-xl border border-amber-500/40 px-3 py-2 text-xs text-foreground/70">
            <p className="font-medium">Założenia (do potwierdzenia):</p>
            <ul className="list-disc pl-4">
              {NOTATION_ASSUMPTIONS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          {skippedCount > 0 && (
            <p className="text-sm text-red-700 dark:text-red-400">
              Pozycje na czerwono nie trafią do receptury.{" "}
              <Link href="/katalog/zglos" className="underline">
                Zgłoś brak
              </Link>
            </p>
          )}

          {ready.length > 0 &&
            (askMode ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm">Receptura ma już farby. Co zrobić?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => insert("replace")} className={`${buttonStyles.primary} h-11`}>
                    Zastąp
                  </button>
                  <button type="button" onClick={() => insert("append")} className={`${buttonStyles.secondary} h-11`}>
                    Dodaj mieszanki
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (hasItems ? setAskMode(true) : insert("replace"))}
                className={buttonStyles.primary}
              >
                Wstaw do receptury
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
