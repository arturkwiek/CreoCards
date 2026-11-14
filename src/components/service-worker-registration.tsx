"use client";

import { useEffect } from "react";

/**
 * Rejestruje minimalny service worker (public/sw.js), wymagany do instalacji PWA.
 * Obsługa offline i cache – Etap 7.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Brak SW nie blokuje działania aplikacji.
      });
  }, []);

  return null;
}
