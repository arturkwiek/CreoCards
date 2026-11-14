export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div
        aria-hidden
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand text-4xl font-bold text-white"
      >
        C
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">CreoCards</h1>
        <p className="text-base text-foreground/70">
          Kartoteka klientek, wizyt i receptur koloryzacji studia Creo.
        </p>
      </div>
      <p className="max-w-xs text-sm text-foreground/60">
        Aplikacja jest w przygotowaniu. Dodaj ją do ekranu głównego telefonu, aby mieć ją
        zawsze pod ręką.
      </p>
    </main>
  );
}
