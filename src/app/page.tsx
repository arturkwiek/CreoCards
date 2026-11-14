import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonStyles } from "@/components/styles";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSession } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/validation";

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
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-foreground/60">{user.salonName}</p>
        <h1 className="text-2xl font-semibold">
          Cześć{user.fullName ? `, ${user.fullName}` : ""}!
        </h1>
        <p className="text-sm text-foreground/60">{ROLE_LABELS[user.role]}</p>
      </div>

      <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/70">
        Klientki, wizyty i receptury pojawią się tu w kolejnych etapach.
      </p>

      {user.role === "owner" && (
        <Link href="/zespol" className={buttonStyles.primary}>
          Zespół i zaproszenia
        </Link>
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
