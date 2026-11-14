// Klasy współdzielone przez komponenty serwerowe i klienckie (zwykły moduł, nie "use client").
const buttonBase =
  "inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-base font-semibold transition-colors disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-brand text-white active:bg-brand/90`,
  secondary: `${buttonBase} border border-foreground/20 bg-background text-foreground active:bg-foreground/5`,
  danger: `${buttonBase} border border-red-600/40 text-red-700 active:bg-red-50 dark:text-red-400`,
};
