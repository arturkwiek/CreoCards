"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { EMPTY_PRODUCT_FORM, NEW_LINE, type ProductFormValues } from "@/lib/catalog/form";
import {
  BRAND_MAX,
  LINE_MAX,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  SHADE_MAX,
  formatRatio,
} from "@/lib/catalog/values";
import { saveProduct, type ProductFormState } from "./actions";
import type { CatalogLine } from "./data";
import { RatioPicker } from "./ratio-picker";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-red-700 dark:text-red-400">{message}</p> : null;
}

const lineName = (l: CatalogLine) => (l.name ? `${l.brand} – ${l.name}` : l.brand);

/** Dodawanie i edycja produktu (właścicielka). Linia z listy albo nowa marka i linia. */
export function ProductForm({
  id,
  initial = EMPTY_PRODUCT_FORM,
  lines,
  cancelHref,
}: {
  id?: string;
  initial?: ProductFormValues;
  lines: CatalogLine[];
  cancelHref: string;
}) {
  const [state, action] = useActionState<ProductFormState, FormData>(saveProduct, {});
  const [values, setValues] = useState<ProductFormValues>(() => ({
    ...initial,
    line_id: initial.line_id || (lines.length === 0 ? NEW_LINE : ""),
  }));
  const errors = state.errors ?? {};
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const selectedLine = lines.find((l) => l.id === values.line_id);
  const isNewLine = values.line_id === NEW_LINE;
  const lineRatioText = isNewLine ? values.line_ratio : formatRatio(selectedLine?.default_ratio);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {id && <input type="hidden" name="id" value={id} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="product-line" className="text-sm font-medium">
          Marka i linia
        </label>
        <select
          id="product-line"
          name="line_id"
          value={values.line_id}
          onChange={(e) => set("line_id", e.target.value)}
          className="h-12 rounded-xl border border-foreground/20 bg-background px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        >
          <option value="" disabled>
            Wybierz…
          </option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {lineName(l)}
            </option>
          ))}
          <option value={NEW_LINE}>+ Nowa marka / linia</option>
        </select>
        <FieldError message={errors.line_id} />
      </div>

      {isNewLine && (
        <div className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
          <div className="flex flex-col gap-1.5">
            <TextField
              label="Marka"
              id="product-brand"
              name="brand"
              autoComplete="off"
              maxLength={BRAND_MAX}
              value={values.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
            <FieldError message={errors.brand} />
          </div>
          <div className="flex flex-col gap-1.5">
            <TextField
              label="Linia (opcjonalnie)"
              id="product-line-name"
              name="line_name"
              autoComplete="off"
              maxLength={LINE_MAX}
              value={values.line_name}
              onChange={(e) => set("line_name", e.target.value)}
            />
            <FieldError message={errors.line_name} />
          </div>
          <RatioPicker
            name="line_ratio"
            label="Domyślna proporcja linii"
            emptyLabel="Brak"
            value={values.line_ratio}
            onChange={(v) => set("line_ratio", v)}
            error={errors.line_ratio}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <TextField
          label="Odcień / stężenie"
          id="product-shade"
          name="shade"
          autoComplete="off"
          placeholder="np. 7.1 albo 6%"
          maxLength={SHADE_MAX}
          autoFocus={!id && Boolean(initial.line_id)}
          value={values.shade}
          onChange={(e) => set("shade", e.target.value)}
        />
        <FieldError message={errors.shade} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Typ</legend>
        <input type="hidden" name="type" value={values.type} />
        <div className="flex flex-wrap gap-2">
          {PRODUCT_TYPES.map((t) => {
            const on = values.type === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => set("type", t)}
                className={`min-h-11 rounded-xl border px-3 py-2 text-base font-medium ${
                  on ? "border-brand bg-brand text-white" : "border-foreground/20 text-foreground"
                }`}
              >
                {PRODUCT_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
        <FieldError message={errors.type} />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Pojemność (g/ml)"
            id="product-size"
            name="package_size"
            inputMode="decimal"
            autoComplete="off"
            placeholder="60"
            value={values.package_size}
            onChange={(e) => set("package_size", e.target.value)}
          />
          <FieldError message={errors.package_size} />
        </div>
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Cena zakupu (zł)"
            id="product-price"
            name="purchase_price"
            inputMode="decimal"
            autoComplete="off"
            placeholder="opcjonalnie"
            value={values.purchase_price}
            onChange={(e) => set("purchase_price", e.target.value)}
          />
          <FieldError message={errors.purchase_price} />
        </div>
      </div>

      <RatioPicker
        name="ratio"
        label="Proporcja dla tego produktu"
        emptyLabel={lineRatioText ? `Jak w linii (${lineRatioText})` : "Jak w linii (brak)"}
        value={values.ratio}
        onChange={(v) => set("ratio", v)}
        error={errors.ratio}
      />

      <FormMessage error={state.error} />
      <SubmitButton pendingText="Zapisywanie…">{id ? "Zapisz zmiany" : "Zapisz produkt"}</SubmitButton>
      <Link href={cancelHref} className={buttonStyles.secondary}>
        {id ? "Anuluj" : "Gotowe"}
      </Link>
    </form>
  );
}
