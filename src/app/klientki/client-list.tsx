"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPhone } from "@/lib/clients/phone";
import { filterClients } from "@/lib/clients/search";

export type ClientListItem = {
  id: string;
  full_name: string;
  phone: string;
  phone_digits: string;
  allergy_status: "none" | "has" | "unknown";
  updated_at: string;
};

/**
 * Lista klientek z wyszukiwaniem w przeglądarce – fraza nie trafia do URL-a ani na serwer.
 * Bez frazy: ostatnio zmienione na górze; z frazą: najlepsze dopasowania.
 */
export function ClientList({ clients }: { clients: ClientListItem[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => filterClients(clients, query), [clients, query]);

  if (clients.length === 0) {
    return (
      <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-foreground/70">
        Dodaj pierwszą klientkę – zajmie 20 sekund.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="client-search" className="sr-only">
        Szukaj klientki
      </label>
      <input
        id="client-search"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Imię, nazwisko lub 3 cyfry telefonu"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 rounded-xl border border-foreground/20 bg-background px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />

      {results.length === 0 ? (
        <p className="px-1 py-4 text-center text-foreground/60">Brak klientek pasujących do wyszukiwania.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 rounded-xl border border-foreground/10">
          {results.map((c) => (
            <li key={c.id}>
              <Link
                href={`/klientki/${c.id}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 active:bg-foreground/5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.full_name}</span>
                  <span className="block text-sm text-foreground/60">{formatPhone(c.phone)}</span>
                </span>
                {c.allergy_status === "has" && (
                  <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                    Alergie
                  </span>
                )}
                {c.allergy_status === "unknown" && (
                  <span className="shrink-0 rounded-full border border-red-600 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400">
                    Alergie?
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
