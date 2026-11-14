// Minimalny service worker CreoCards – umożliwia instalację PWA.
// Nie cache'uje danych; obsługa offline zostanie dodana w Etapie 7.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: przeglądarka obsługuje żądania standardowo.
});
