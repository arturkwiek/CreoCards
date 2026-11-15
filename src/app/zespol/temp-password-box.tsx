"use client";

import { useState } from "react";
import { buttonStyles } from "@/components/styles";

/** Hasło tymczasowe – pokazywane tylko raz, z przyciskiem kopiowania. */
export function TempPasswordBox({ password, login }: { password: string; login?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950">
      <p className="text-sm font-medium">Hasło tymczasowe{login ? ` dla „${login}”` : ""}</p>
      <input
        readOnly
        aria-label="Hasło tymczasowe"
        value={password}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 rounded-lg border border-foreground/20 bg-background px-3 font-mono text-base tracking-wider"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className={buttonStyles.primary}
      >
        {copied ? "Skopiowano ✓" : "Kopiuj hasło"}
      </button>
      <p className="text-xs text-foreground/70">
        Widoczne tylko teraz. Przekaż je osobiście lub SMS-em – przy pierwszym logowaniu trzeba ustawić własne hasło.
      </p>
    </div>
  );
}
