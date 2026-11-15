import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/ui";
import { visibleEmail } from "@/lib/auth/login";
import { requireOwner } from "@/lib/auth/session";
import { isAuthEmailEnabled } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/validation";
import { deactivateMember, reactivateMember } from "./actions";
import { InviteForm } from "./invite-form";
import { MemberLoginForm } from "./member-login-form";
import { MemberPasswordLink } from "./member-password-link";
import { PendingInvitationActions } from "./pending-invitation-actions";

export const metadata: Metadata = { title: "Zespół – CreoCards" };

async function TeamContent() {
  const owner = await requireOwner();
  const supabase = await createClient();

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, login, role, deleted_at")
      .order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, login, full_name, role, created_at")
      .is("accepted_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Dodaj osobę</h2>
        <InviteForm emailEnabled={isAuthEmailEnabled()} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Osoby</h2>
        <ul className="flex flex-col gap-2">
          {(members ?? []).map((m) => {
            const inactive = m.deleted_at !== null;
            // Adres techniczny (konto bez e-maila) nigdy nie jest pokazywany.
            const email = visibleEmail(m.email);
            const name = m.full_name || m.login || email;
            return (
              <li
                key={m.id}
                className={`flex flex-col gap-3 rounded-xl border border-foreground/10 p-4 ${inactive ? "opacity-60" : ""}`}
              >
                <div>
                  <p className="font-medium">{name}</p>
                  {!m.full_name && (
                    <p className="text-sm text-foreground/60">Imię nieuzupełnione</p>
                  )}
                  <p className="text-sm text-foreground/60">
                    {ROLE_LABELS[m.role]}
                    {inactive ? " · dezaktywowane" : ""}
                    {m.id === owner.id ? " · to Ty" : ""}
                  </p>
                  {m.login && <p className="text-sm text-foreground/60">Login: {m.login}</p>}
                  {email && name !== email && <p className="text-sm text-foreground/60">{email}</p>}
                </div>
                {!inactive && <MemberLoginForm id={m.id} login={m.login} />}
                {m.id !== owner.id && !inactive && <MemberPasswordLink id={m.id} />}
                {m.id !== owner.id && (
                  <form action={inactive ? reactivateMember : deactivateMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <SubmitButton variant={inactive ? "secondary" : "danger"}>
                      {inactive ? "Przywróć dostęp" : "Dezaktywuj konto"}
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {(invitations ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Oczekujące zaproszenia</h2>
          <ul className="flex flex-col gap-2">
            {(invitations ?? []).map((inv) => (
              <li key={inv.id} className="flex flex-col gap-3 rounded-xl border border-dashed border-foreground/20 p-4">
                <div>
                  <p className="font-medium">{inv.full_name || inv.login || visibleEmail(inv.email)}</p>
                  <p className="text-sm text-foreground/60">
                    {ROLE_LABELS[inv.role]}
                    {inv.login ? ` · login: ${inv.login}` : ""}
                    {visibleEmail(inv.email) && inv.full_name ? ` · ${visibleEmail(inv.email)}` : ""}
                  </p>
                </div>
                <PendingInvitationActions id={inv.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function TeamPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Zespół</h1>
        <Link href="/" className="text-sm text-brand underline-offset-4 hover:underline">
          Wróć
        </Link>
      </div>

      <Suspense fallback={<p className="text-foreground/60">Ładowanie…</p>}>
        <TeamContent />
      </Suspense>
    </main>
  );
}
