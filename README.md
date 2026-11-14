# CreoCards

Aplikacja dla studia fryzur **Creo**: kartoteka klientek, historia wizyt i receptury koloryzacji (farby, utleniacze, proporcje), ze zdjęciami, notatkami głosowymi i magazynem preparatów.

## Dokumentacja
- [docs/SPEC.md](docs/SPEC.md) – wymagania funkcjonalne i techniczne (MVP)
- [docs/ROADMAP.md](docs/ROADMAP.md) – etapy wdrożenia, kryteria akceptacji, quick guide
- [docs/PRZEWODNIK.md](docs/PRZEWODNIK.md) – przewodnik na start dla zespołu salonu
- [docs/WDROZENIE-STAGING.md](docs/WDROZENIE-STAGING.md) – staging: Supabase, SMTP (Resend), Vercel, pierwsza właścicielka
- [AGENTS.md](AGENTS.md) – reguły dla agentów AI
- [docs/katalog-przyklad.csv](docs/katalog-przyklad.csv) – przykładowy plik importu katalogu

## Stos
Next.js + TypeScript + Tailwind (PWA), Supabase (PostgreSQL, Auth, Storage, region UE), Vercel.

## Uruchomienie lokalne
Środowisko: **WSL Ubuntu, Node.js 22 (nvm)**. Polecenia npm uruchamiaj w WSL, nie z Windowsa.

```bash
npm install
cp .env.example .env.local   # uzupełnij klucze projektu Supabase (staging)
npm run dev                  # http://localhost:3000
```

| Polecenie | Opis |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generowanie typów tras + `tsc --noEmit` |
| `npm test` | Testy (Vitest) |
| `npm run build` | Build produkcyjny |
| `npm run db:test` | Testy RLS (pgTAP) – wymaga `npx supabase start` |
| `npm run db:types` | Typy TS z lokalnej bazy |
| `npm run bootstrap -- --salon "Creo" --email …` | Salon + zaproszenie właścicielki |

Service worker (`public/sw.js`) rejestruje się tylko w buildzie produkcyjnym (`npm run build && npm start`).

Baza danych: zmiany wyłącznie jako migracje w `supabase/migrations/` (Supabase CLI: `npx supabase migration new <nazwa>`). Szczegóły w `AGENTS.md`.

## Status
Etap 1 – Konta i role (logowanie, zaproszenia, role, RLS). Kolejne kroki: `docs/ROADMAP.md`.
