import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/ui";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { isAuthEmailEnabled } from "@/lib/features";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nie pamiętam hasła – CreoCards" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Nie pamiętam hasła">
      {isAuthEmailEnabled() ? (
        <>
          <p className="text-sm text-foreground/70">
            Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.
          </p>
          <ResetForm />
        </>
      ) : (
        <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/70">
          Poproś właścicielkę salonu o link do ustawienia hasła. Utworzy go w sekcji{" "}
          <strong>Zespół</strong> przyciskiem „Utwórz link do ustawienia hasła”.
        </p>
      )}
      <Link href={LOGIN_PATH} className="text-center text-sm text-brand underline-offset-4 hover:underline">
        Wróć do logowania
      </Link>
    </AuthCard>
  );
}
