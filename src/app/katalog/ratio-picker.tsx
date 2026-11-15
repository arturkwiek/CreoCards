"use client";

import { useState } from "react";
import { RATIO_PRESETS, formatRatio, parseRatio } from "@/lib/catalog/values";

const chip = "min-h-11 rounded-xl border px-3 py-2 text-base font-medium";
const chipOn = "border-brand bg-brand text-white";
const chipOff = "border-foreground/20 text-foreground";

/**
 * Proporcja farba:utleniacz przyciskami (1:1, 1:1,5, 1:2, własna). Wartość w polu `name`
 * jako tekst („1:1,5”; pusty = brak / jak w linii).
 */
export function RatioPicker({
  name,
  label,
  value,
  onChange,
  emptyLabel,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Etykieta przycisku „bez proporcji”, np. „Brak” albo „Jak w linii (1:1,5)”. */
  emptyLabel: string;
  error?: string;
}) {
  const parsed = parseRatio(value);
  const preset = typeof parsed === "number" ? RATIO_PRESETS.find((r) => r === parsed) : undefined;
  const [custom, setCustom] = useState(value.trim() !== "" && preset === undefined);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!custom && value.trim() === ""}
          onClick={() => {
            setCustom(false);
            onChange("");
          }}
          className={`${chip} ${!custom && value.trim() === "" ? chipOn : chipOff}`}
        >
          {emptyLabel}
        </button>
        {RATIO_PRESETS.map((r) => {
          const on = !custom && preset === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setCustom(false);
                onChange(formatRatio(r));
              }}
              className={`${chip} ${on ? chipOn : chipOff}`}
            >
              {formatRatio(r)}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustom(true)}
          className={`${chip} ${custom ? chipOn : chipOff}`}
        >
          Własna
        </button>
      </div>
      {custom && (
        <input
          aria-label={`${label} – własna`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="np. 1:1,8"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 rounded-xl border border-foreground/20 bg-background px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}
