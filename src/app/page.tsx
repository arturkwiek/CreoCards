import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonStyles } from "@/components/styles";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSession } from "@/lib/auth/session";
import { greeting, needsFullName } from "@/lib/profile/name";
import { ROLE_LABELS } from "@/lib/validation";
import { countOpenRequests } from "./katalog/data";
import { NamePrompt } from "./name-prompt";

function requestsWord(n: number): string {
  if (n === 1) return "zgłoszenie";
  const tens = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? "zgłoszenia" : "zgłoszeń";
}

async function HomeContent() {
  const session = await getSession();

  if (session.status === "anonymous") redirect(LOGIN_PATH);

  if (session.status === "no-access") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Brak dostępu</h1>
        <p className="text-foreground/70">
          To konto nie jest przypisane do salonu lub zostało dezaktywowane. Skontaktuj się z
          właścicielką salonu.
        </p>
        <SignOutButton />
      </div>
    );
  }

  const { user } = session;
  // Powiadomienie właścicielki o zgłoszeniach „Zgłoś brak”.
  const openRequests = user.role === "owner" ? await countOpenRequests() : 0;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-foreground/60">{user.salonName}</p>
        <h1 className="text-2xl font-semibold">{greeting(user.fullName)}</h1>
        <p className="text-sm text-foreground/60">{ROLE_LABELS[user.role]}</p>
      </div>

      {needsFullName(user.fullName) && <NamePrompt />}

      <Link href="/klientki" className={buttonStyles.primary}>
        Klientki
      </Link>
      <Link href="/katalog" className={buttonStyles.secondary}>
        Katalog preparatów
        {openRequests > 0 && (
          <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
            {openRequests} {requestsWord(openRequests)}
          </span>
        )}
      </Link>

      <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/70">
        Wizytę i recepturę zapiszesz z karty klientki.
      </p>

      {user.role === "owner" && (
        <>
          <Link href="/uslugi" className={buttonStyles.secondary}>
            Usługi
          </Link>
          <Link href="/zespol" className={buttonStyles.secondary}>
            Zespół i zaproszenia
          </Link>
        </>
      )}
      <SignOutButton />
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
