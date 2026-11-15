"use client";

import { useState } from "react";
import { buttonStyles } from "@/components/styles";

/** Pokazuje jednorazowy link (zaproszenie lub ustawienie hasła) z przyciskiem kopiowania. */
export function InviteLinkBox({ link, label = "Link zaproszenia" }: { link: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Brak dostępu do schowka – link jest zaznaczony w polu, można skopiować ręcznie.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
      <label className="text-sm font-medium" htmlFor={`link-${link.slice(-8)}`}>
        {label}
      </label>
      <input
        id={`link-${link.slice(-8)}`}
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 rounded-lg border border-foreground/20 bg-background px-3 text-sm"
      />
      <button type="button" onClick={copy} className={buttonStyles.primary}>
        {copied ? "Skopiowano ✓" : "Kopiuj link"}
      </button>
      <p className="text-xs text-foreground/60">
        Link jest jednorazowy, ważny 24 godziny i działa tylko dla tej osoby – przekaż go
        bezpośrednio (np. SMS-em). Utworzenie nowego linku unieważnia poprzedni.
      </p>
    </div>
  );
}
