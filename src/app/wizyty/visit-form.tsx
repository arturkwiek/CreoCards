"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { filterProducts } from "@/lib/catalog/search";
import { RATIO_PRESETS, formatNumber, formatRatio, parseRatio, type ProductType } from "@/lib/catalog/values";
import { formatDuration, formatPriceRange } from "@/lib/services/import";
import {
  EMPTY_MIX,
  GRAM_PRESETS,
  GRAM_STEP,
  MAX_ITEMS,
  MAX_MIXES,
  OXIDANT_PERCENTS,
  RECIPE_NOTE_MAX,
  TIME_PRESETS,
  TIME_STEP,
  ZONES,
  ZONE_LABELS,
  copyRecipe,
  dyeGrams,
  oxidantGrams,
  suggestRatio,
  type DraftMix,
  type DraftRecipe,
} from "@/lib/visits/recipe";
import { saveVisit, type VisitFormState } from "./actions";

export type VisitProduct = {
  id: string;
  brand: string;
  line: string;
  shade: string;
  type: ProductType;
  ratio: number | null;
  line_ratio: number | null;
};

export type VisitService = {
  id: string;
  name: string;
  price_from: number | null;
  price_to: number | null;
  duration_min: number | null;
  with_color: boolean;
};

type EditMix = DraftMix & { key: number; ratioTouched: boolean };

const chip = "min-h-11 rounded-xl border px-3 py-2 text-base font-medium";
const on = "border-brand bg-brand text-white";
const off = "border-foreground/20 text-foreground";
const small = "flex h-11 min-w-11 items-center justify-center rounded-xl border border-foreground/20 px-3 text-lg font-semibold";

let nextKey = 1;
const withKeys = (mixes: DraftMix[]): EditMix[] => mixes.map((m) => ({ ...m, key: nextKey++, ratioTouched: true }));

function ProductPicker({ products, onPick }: { products: VisitProduct[]; onPick: (p: VisitProduct) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => (query.trim() ? filterProducts(products, query) : products).slice(0, 8),
    [products, query],
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonStyles.secondary} h-11`}>
        + Dodaj farbę
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand/40 p-3">
      <input
        type="search"
        autoFocus
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Szukaj farby"
        placeholder="Odcień (np. 7.1), marka lub linia"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11 rounded-xl border border-foreground/20 bg-background px-3 text-base outline-none focus:border-brand"
      />
      {!query.trim() && <p className="text-xs text-foreground/60">Najczęściej używane</p>}
      {results.length === 0 ? (
        <p className="py-2 text-sm text-foreground/60">
          Brak w katalogu. <Link href="/katalog/zglos" className="text-brand underline">Zgłoś brak</Link>
        </p>
      ) : (
        <ul className="flex flex-col">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-3 border-b border-foreground/10 px-1 text-left active:bg-foreground/5"
              >
                <span className="min-w-14 font-semibold">{p.shade}</span>
                <span className="truncate text-sm text-foreground/60">{[p.brand, p.line].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-foreground/60">
        Zamknij
      </button>
    </div>
  );
}

function MixEditor({
  mix,
  index,
  products,
  productsById,
  onChange,
  onRemove,
}: {
  mix: EditMix;
  index: number;
  products: VisitProduct[];
  productsById: Map<string, VisitProduct>;
  onChange: (mix: EditMix) => void;
  onRemove: () => void;
}) {
  const presetRatio = mix.ratio !== null && (RATIO_PRESETS as readonly number[]).includes(mix.ratio);
  const [customRatio, setCustomRatio] = useState(mix.ratio !== null && !presetRatio ? formatRatio(mix.ratio) : "");
  const [customOpen, setCustomOpen] = useState(mix.ratio !== null && !presetRatio);

  const update = (patch: Partial<EditMix>) => onChange({ ...mix, ...patch });
  const setItems = (items: EditMix["items"]) => {
    // Podpowiedź proporcji z pierwszego produktu, dopóki nie została zmieniona ręcznie.
    const ratio = mix.ratioTouched ? mix.ratio : (suggestRatio(items, productsById) ?? mix.ratio);
    onChange({ ...mix, items, ratio });
  };
  const setGrams = (i: number, grams: number) =>
    setItems(mix.items.map((it, j) => (j === i ? { ...it, grams: Math.min(1000, Math.max(1, grams)) } : it)));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-foreground/15 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Mieszanka {index + 1}</h3>
        <button type="button" onClick={onRemove} className="text-sm text-red-700 dark:text-red-400">
          Usuń mieszankę
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Strefa">
        {ZONES.map((z) => (
          <button key={z} type="button" aria-pressed={mix.zone === z} onClick={() => update({ zone: z })} className={`${chip} ${mix.zone === z ? on : off}`}>
            {ZONE_LABELS[z]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {mix.items.map((item, i) => {
          const p = productsById.get(item.product_id);
          return (
            <div key={`${item.product_id}-${i}`} className="flex flex-col gap-2 rounded-xl bg-foreground/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0">
                  <span className="text-lg font-semibold">{p?.shade ?? "?"}</span>{" "}
                  <span className="text-sm text-foreground/60">{p ? [p.brand, p.line].filter(Boolean).join(" · ") : ""}</span>
                </p>
                <button
                  type="button"
                  aria-label="Usuń farbę"
                  onClick={() => setItems(mix.items.filter((_, j) => j !== i))}
                  className="px-2 text-lg text-foreground/60"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-label="Mniej" onClick={() => setGrams(i, item.grams - GRAM_STEP)} className={small}>
                  −
                </button>
                <label className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={1000}
                    aria-label="Gramy"
                    value={item.grams}
                    onChange={(e) => setGrams(i, Number(e.target.value) || 1)}
                    className="h-11 w-16 rounded-xl border border-foreground/20 bg-background text-center text-base"
                  />
                  g
                </label>
                <button type="button" aria-label="Więcej" onClick={() => setGrams(i, item.grams + GRAM_STEP)} className={small}>
                  +
                </button>
                {GRAM_PRESETS.map((g) => (
                  <button key={g} type="button" onClick={() => setGrams(i, g)} className={`${chip} min-h-11 ${item.grams === g ? on : off}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {mix.items.length < MAX_ITEMS && (
          <ProductPicker products={products} onPick={(p) => setItems([...mix.items, { product_id: p.id, grams: GRAM_PRESETS[0] }])} />
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Utleniacz</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={mix.oxidant_percent === null}
            onClick={() => update({ oxidant_percent: null })}
            className={`${chip} ${mix.oxidant_percent === null ? on : off}`}
          >
            Bez utleniacza
          </button>
          {OXIDANT_PERCENTS.map((pct) => (
            <button
              key={pct}
              type="button"
              aria-pressed={mix.oxidant_percent === pct}
              onClick={() => update({ oxidant_percent: pct })}
              className={`${chip} ${mix.oxidant_percent === pct ? on : off}`}
            >
              {pct}%
            </button>
          ))}
        </div>
        {mix.oxidant_percent !== null && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Proporcja">
              {RATIO_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={!customOpen && mix.ratio === r}
                  onClick={() => {
                    setCustomOpen(false);
                    update({ ratio: r, ratioTouched: true });
                  }}
                  className={`${chip} ${!customOpen && mix.ratio === r ? on : off}`}
                >
                  {formatRatio(r)}
                </button>
              ))}
              <button type="button" aria-pressed={customOpen} onClick={() => setCustomOpen(true)} className={`${chip} ${customOpen ? on : off}`}>
                Własna
              </button>
            </div>
            {customOpen && (
              <input
                aria-label="Własna proporcja"
                inputMode="decimal"
                autoComplete="off"
                placeholder="np. 1:1,8"
                value={customRatio}
                onChange={(e) => {
                  setCustomRatio(e.target.value);
                  const r = parseRatio(e.target.value);
                  update({ ratio: typeof r === "number" ? r : null, ratioTouched: true });
                }}
                className="h-11 rounded-xl border border-foreground/20 bg-background px-3 text-base"
              />
            )}
            <p className="text-sm">
              {mix.ratio === null ? (
                <span className="text-red-700 dark:text-red-400">Wybierz proporcję.</span>
              ) : (
                <>
                  Utleniacz: <b>{formatNumber(oxidantGrams(mix))} g</b>{" "}
                  <span className="text-foreground/60">
                    ({formatNumber(dyeGrams(mix))} g × {formatNumber(mix.ratio)})
                  </span>
                </>
              )}
            </p>
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          Czas trzymania{mix.processing_minutes !== null ? `: ${mix.processing_minutes} min` : ""}
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Krócej"
            onClick={() => update({ processing_minutes: Math.max(0, (mix.processing_minutes ?? 30) - TIME_STEP) })}
            className={small}
          >
            −
          </button>
          {TIME_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={mix.processing_minutes === t}
              onClick={() => update({ processing_minutes: mix.processing_minutes === t ? null : t })}
              className={`${chip} ${mix.processing_minutes === t ? on : off}`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            aria-label="Dłużej"
            onClick={() => update({ processing_minutes: Math.min(600, (mix.processing_minutes ?? 30) + TIME_STEP) })}
            className={small}
          >
            +
          </button>
        </div>
      </fieldset>
    </section>
  );
}

/** Nowa wizyta / edycja: usługa, data (także wstecz), cena, receptura z mieszankami. */
export function VisitForm({
  clientId,
  visitId,
  services,
  products,
  initial,
  lastRecipe,
  cancelHref,
}: {
  clientId: string;
  visitId?: string;
  services: VisitService[];
  /** Bez utleniaczy, posortowane wg użycia. */
  products: VisitProduct[];
  initial: { service_id: string; visit_at: string; price: string; recipe: DraftRecipe };
  lastRecipe: DraftRecipe | null;
  cancelHref: string;
}) {
  const [state, action] = useActionState<VisitFormState, FormData>(saveVisit, {});
  const [serviceId, setServiceId] = useState(initial.service_id);
  const [visitAt, setVisitAt] = useState(initial.visit_at);
  const [price, setPrice] = useState(initial.price);
  const [note, setNote] = useState(initial.recipe.note);
  const [mixes, setMixes] = useState<EditMix[]>(() => withKeys(initial.recipe.mixes));
  const service = services.find((s) => s.id === serviceId);
  const [showRecipe, setShowRecipe] = useState(initial.recipe.mixes.length > 0 || Boolean(service?.with_color));

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const hasItems = mixes.some((m) => m.items.length > 0);
  const repeat = lastRecipe ? copyRecipe(lastRecipe, productIds) : null;

  const openRecipe = () => {
    setShowRecipe(true);
    if (mixes.length === 0) setMixes([{ ...EMPTY_MIX, key: nextKey++, ratioTouched: false }]);
  };

  const recipeJson = JSON.stringify({
    note: showRecipe ? note : "",
    mixes: showRecipe
      ? mixes.map((m) => ({
          zone: m.zone,
          oxidant_percent: m.oxidant_percent,
          ratio: m.ratio,
          processing_minutes: m.processing_minutes,
          items: m.items,
        }))
      : [],
  });

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {(visitId ?? state.visitId) && <input type="hidden" name="id" value={visitId ?? state.visitId} />}
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="recipe" value={recipeJson} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Usługa</legend>
        {services.length === 0 ? (
          <p className="text-sm text-foreground/60">Lista usług jest pusta – właścicielka dodaje ją w „Usługach”.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={serviceId === s.id}
                onClick={() => {
                  const next = serviceId === s.id ? "" : s.id;
                  setServiceId(next);
                  if (next && s.with_color) openRecipe();
                }}
                className={`${chip} ${serviceId === s.id ? on : off}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        {service && (
          <p className="text-sm text-foreground/60">
            {[formatPriceRange(service.price_from, service.price_to), formatDuration(service.duration_min)].filter(Boolean).join(" · ")}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="visit-at" className="text-sm font-medium">
            Data wizyty
          </label>
          <input
            id="visit-at"
            name="visit_at"
            type="datetime-local"
            value={visitAt}
            onChange={(e) => setVisitAt(e.target.value)}
            className="h-12 min-w-0 rounded-xl border border-foreground/20 bg-background px-3 text-base"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="visit-price" className="text-sm font-medium">
            Cena (zł)
          </label>
          <input
            id="visit-price"
            name="price"
            inputMode="decimal"
            autoComplete="off"
            placeholder={service?.price_from != null ? String(service.price_from) : "opcj."}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-12 min-w-0 rounded-xl border border-foreground/20 bg-background px-3 text-base"
          />
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Receptura</h2>
        {repeat && repeat.mixes.length > 0 && !hasItems && (
          <button
            type="button"
            onClick={() => {
              setMixes(withKeys(repeat.mixes));
              setNote(repeat.note);
              setShowRecipe(true);
            }}
            className={buttonStyles.primary}
          >
            Powtórz ostatnią recepturę
          </button>
        )}
        {!showRecipe ? (
          <button type="button" onClick={openRecipe} className={buttonStyles.secondary}>
            + Dodaj recepturę
          </button>
        ) : (
          <>
            {mixes.map((m, i) => (
              <MixEditor
                key={m.key}
                mix={m}
                index={i}
                products={products}
                productsById={productsById}
                onChange={(next) => setMixes((all) => all.map((x) => (x.key === m.key ? next : x)))}
                onRemove={() => setMixes((all) => all.filter((x) => x.key !== m.key))}
              />
            ))}
            {mixes.length < MAX_MIXES && (
              <button
                type="button"
                onClick={() => setMixes((all) => [...all, { ...EMPTY_MIX, key: nextKey++, ratioTouched: false }])}
                className={buttonStyles.secondary}
              >
                + Dodaj mieszankę
              </button>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="recipe-note" className="text-sm font-medium">
                Notatka do receptury
              </label>
              <textarea
                id="recipe-note"
                rows={2}
                maxLength={RECIPE_NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl border border-foreground/20 bg-background px-4 py-3 text-base"
              />
            </div>
          </>
        )}
      </section>

      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">{visitId ? "Zapisz zmiany" : "Zapisz wizytę"}</SubmitButton>
      {!visitId && (
        <SubmitButton name="next" value="photos" variant="secondary" pendingText="Zapisywanie…">
          Zapisz i dodaj zdjęcia
        </SubmitButton>
      )}
      <Link href={cancelHref} className={buttonStyles.secondary}>
        Anuluj
      </Link>
    </form>
  );
}
