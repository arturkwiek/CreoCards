import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, FormMessage } from "@/components/ui";
import { accountIdentity } from "@/lib/auth/login";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSession } from "@/lib/auth/session";
import { PASSWORD_MIN_LENGTH, ROLE_LABELS } from "@/lib/validation";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Ustaw hasło – CreoCards" };

/** Dla jakiego konta ustawiane jest hasło – dane z sesji po „Kontynuuj” (albo po logowaniu hasłem tymczasowym). */
async function SetPasswordContent() {
  const session = await getSession();
  if (session.status !== "active") {
    return (
      <>
        <FormMessage error="Link wygasł albo konto jest nieaktywne. Poproś właścicielkę salonu o nowy link." />
        <Link href={LOGIN_PATH} className="text-center text-sm text-brand underline-offset-4 hover:underline">
          Przejdź do logowania
        </Link>
      </>
    );
  }
  const { user } = session;
  const identity = accountIdentity(user);
  return (
    <>
      <section aria-label="Konto" className="rounded-xl bg-foreground/5 px-4 py-3 text-sm">
        <p className="font-medium">
          Konto: {user.fullName || "bez imienia"}
          {identity.value && ` · ${identity.kind === "login" ? "login" : "e-mail"}: ${identity.value}`}
        </p>
        <p className="text-foreground/70">
          {user.salonName} · {ROLE_LABELS[user.role]}
        </p>
      </section>
      <p className="text-sm text-foreground/70">Co najmniej {PASSWORD_MIN_LENGTH} znaków, w tym litera i cyfra.</p>
      <SetPasswordForm identity={identity} />
    </>
  );
}

export default function SetPasswordPage() {
  return (
    <AuthCard title="Ustaw hasło">
      <Suspense fallback={<p className="text-sm text-foreground/60">Ładowanie…</p>}>
        <SetPasswordContent />
      </Suspense>
    </AuthCard>
  );
}
