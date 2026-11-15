"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buttonStyles } from "@/components/styles";
import { REQUEST_TEXT_MAX } from "@/lib/catalog/values";
import { createRequest, type RequestFormState } from "./actions";

/**
 * „Zgłoś brak”: z produktem – „kończy się”; bez produktu – „nie ma w katalogu” z opisem.
 * Zgłoszenie trafia na listę zgłoszeń właścicielki.
 */
export function RequestForm({ product }: { product?: { id: string; label: string } }) {
  const [state, action] = useActionState<RequestFormState, FormData>(createRequest, {});

  if (state.done) {
    return (
      <div className="flex flex-col gap-3">
        <FormMessage success="Zgłoszenie wysłane do właścicielki. Dziękujemy!" />
        <Link href="/katalog" className={buttonStyles.secondary}>
          Wróć do katalogu
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={product ? "running_low" : "missing"} />
      {product && <input type="hidden" name="product_id" value={product.id} />}
      <label htmlFor="request-description" className="text-sm font-medium">
        {product ? "Uwagi (opcjonalnie)" : "Czego brakuje w katalogu?"}
      </label>
      <textarea
        id="request-description"
        name="description"
        rows={3}
        maxLength={REQUEST_TEXT_MAX}
        placeholder={product ? "np. zostało pół tubki" : "np. Marka A, Linia Classic 5.5"}
        autoFocus={!product}
        className="rounded-xl border border-foreground/20 bg-background px-4 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Wysyłanie…" variant={product ? "secondary" : "primary"}>
        {product ? "Zgłoś: kończy się" : "Wyślij zgłoszenie"}
      </SubmitButton>
    </form>
  );
}
