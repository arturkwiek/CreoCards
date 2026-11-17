import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/validation";
import { LOGIN_PATH } from "./paths";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  /** Login (konta z loginem) albo null – wtedy logowanie e-mailem. */
  login: string | null;
  role: UserRole;
  salonId: string;
  salonName: string;
};

export type SessionState =
  | { status: "anonymous" }
  | { status: "no-access"; email: string }
  | { status: "active"; user: CurrentUser };

/** Stan sesji dla bieżącego żądania (profil czytany przez RLS – dezaktywacja = brak dostępu). */
export const getSession = cache(async (): Promise<SessionState> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return { status: "anonymous" };

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, login, role, salon_id, salons(name)")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile) {
    return { status: "no-access", email: typeof claims.email === "string" ? claims.email : "" };
  }

  return {
    status: "active",
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      login: profile.login,
      role: profile.role,
      salonId: profile.salon_id,
      salonName: profile.salons?.name ?? "",
    },
  };
});

/** Wymaga aktywnej osoby; w przeciwnym razie przekierowuje. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (session.status !== "active") redirect(session.status === "anonymous" ? LOGIN_PATH : "/");
  return session.user;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/");
  return user;
}
