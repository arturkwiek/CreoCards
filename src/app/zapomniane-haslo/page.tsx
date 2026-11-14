import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/ui";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nie pamiętam hasła – CreoCards" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Nie pamiętam hasła">
      <p className="text-sm text-foreground/70">
        Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.
      </p>
      <ResetForm />
      <Link href={LOGIN_PATH} className="text-center text-sm text-brand underline-offset-4 hover:underline">
        Wróć do logowania
      </Link>
    </AuthCard>
  );
}
