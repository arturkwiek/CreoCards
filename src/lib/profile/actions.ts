"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FULL_NAME_MAX_LENGTH, parseFullName } from "./name";

/** Uzupełnienie własnego imienia (RLS: osoba zmienia tylko swój profil w swoim salonie). */
export async function saveOwnFullName(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fullName = parseFullName(formData.get("full_name"));
  if (!fullName) return { error: `Wpisz imię (do ${FULL_NAME_MAX_LENGTH} znaków).` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Nie udało się zapisać imienia. Spróbuj ponownie." };

  revalidatePath("/");
  revalidatePath("/zespol");
  return { success: "Zapisano." };
}
