import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ClientList } from "./client-list";

export const metadata: Metadata = { title: "Klientki – CreoCards" };

async function ClientsContent() {
  await requireUser();
  const supabase = await createClient();
  // Na liście bez treści alergii – tylko znacznik.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, phone, phone_digits, allergy_status, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  // phone_digits to kolumna generowana – w typach dopuszcza null.
  return <ClientList clients={(clients ?? []).map((c) => ({ ...c, phone_digits: c.phone_digits ?? "" }))} />;
}

export default function ClientsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Klientki</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>

      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <ClientsContent />
      </Suspense>

      {/* Pod kciukiem: główna akcja przyklejona do dołu ekranu. */}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-5 pt-6">
        <div className="mx-auto max-w-md">
          <Link href="/klientki/nowa" className={buttonStyles.primary}>
            + Dodaj klientkę
          </Link>
        </div>
      </div>
    </main>
  );
}
