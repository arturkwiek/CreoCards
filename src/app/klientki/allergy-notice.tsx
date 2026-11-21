import { ASK_ALLERGIES, type AllergyStatus } from "@/lib/clients/form";

/** Wyróżniony blok alergii klientki – na karcie klientki oraz nad recepturą wizyty. */
export function AllergyNotice({ status, allergies }: { status: AllergyStatus; allergies: string }) {
  if (status === "has") {
    return (
      <section
        aria-label="Alergie i uwagi zdrowotne"
        className="rounded-xl border-2 border-red-600 bg-red-50 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100"
      >
        <p className="font-semibold">⚠ Alergie / uwagi zdrowotne</p>
        <p className="mt-1 whitespace-pre-wrap">{allergies || "Brak opisu – dopytaj klientkę przed koloryzacją."}</p>
      </section>
    );
  }
  if (status === "unknown") {
    return (
      <section
        aria-label="Alergie nieuzupełnione"
        role="alert"
        className="rounded-xl border-2 border-red-600 bg-red-50 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100"
      >
        <p className="font-semibold">⚠ {ASK_ALLERGIES}</p>
        <p className="mt-1 text-sm">Alergie nieuzupełnione (klientka dodana przy rezerwacji terminu).</p>
      </section>
    );
  }
  return <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/70">Brak znanych alergii</p>;
}
