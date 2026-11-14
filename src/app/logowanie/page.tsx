import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, FormMessage } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logowanie – CreoCards" };

async function LinkError({ searchParams }: { searchParams: PageProps<"/logowanie">["searchParams"] }) {
  const { blad } = await searchParams;
  if (blad !== "link") return null;
  return <FormMessage error="Link jest nieważny lub wygasł. Poproś o nowy." />;
}

export default function LoginPage({ searchParams }: PageProps<"/logowanie">) {
  return (
    <AuthCard title="Zaloguj się">
      <Suspense>
        <LinkError searchParams={searchParams} />
      </Suspense>
      <LoginForm />
      <Link href="/zapomniane-haslo" className="text-center text-sm text-brand underline-offset-4 hover:underline">
        Nie pamiętam hasła
      </Link>
      <p className="text-center text-xs text-foreground/60">
        Konto zakłada właścicielka salonu – poproś ją o zaproszenie.
      </p>
    </AuthCard>
  );
}
