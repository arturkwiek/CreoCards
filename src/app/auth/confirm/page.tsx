import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, FormMessage, SubmitButton } from "@/components/ui";
import { parseConfirmParams } from "@/lib/auth/confirm";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmLink } from "./actions";

export const metadata: Metadata = {
  title: "Ustaw hasło – CreoCards",
  robots: { index: false, follow: false },
};

const INTRO = {
  invite: "Zaproszenie do zespołu salonu. Kliknij „Kontynuuj”, aby ustawić hasło do swojego konta.",
  recovery: "Kliknij „Kontynuuj”, aby ustawić nowe hasło do swojego konta.",
} as const;

async function ConfirmContent({ searchParams }: { searchParams: PageProps<"/auth/confirm">["searchParams"] }) {
  const { token_hash, type } = await searchParams;
  const params = parseConfirmParams(token_hash, type);

  if (!params) {
    return (
      <>
        <FormMessage error="Link jest niepełny lub nieprawidłowy. Poproś właścicielkę salonu o nowy." />
        <Link href={LOGIN_PATH} className="text-center text-sm text-brand underline-offset-4 hover:underline">
          Przejdź do logowania
        </Link>
      </>
    );
  }

  // Tylko nazwa salonu – przed kliknięciem nie wiadomo, kto otwiera link (bez imienia i loginu). Token nie jest zużywany.
  const { data: salonName } = await createAdminClient().rpc("link_salon_name", { p_token_hash: params.tokenHash });

  return (
    <form action={confirmLink} className="flex flex-col gap-4">
      {salonName && (
        <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm font-medium">
          Ten link ustawia hasło do konta w salonie {salonName}.
        </p>
      )}
      <p className="text-sm text-foreground/70">{INTRO[params.type]}</p>
      <input type="hidden" name="token_hash" value={params.tokenHash} />
      <input type="hidden" name="type" value={params.type} />
      <SubmitButton pendingText="Sprawdzanie linku…">Kontynuuj</SubmitButton>
      <p className="text-xs text-foreground/60">
        Link jest jednorazowy – działa tylko po kliknięciu przycisku.
      </p>
    </form>
  );
}

/**
 * Strona linku zaproszenia / ustawienia hasła. Celowo bez weryfikacji przy wejściu (GET):
 * podglądy linków i skanery poczty otwierają adres, ale nie klikają „Kontynuuj”.
 */
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <AuthCard title="Ustaw hasło">
      <Suspense fallback={<p className="text-sm text-foreground/60">Ładowanie…</p>}>
        <ConfirmContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
