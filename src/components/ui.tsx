"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles } from "./styles";

export function SubmitButton({
  children,
  pendingText = "Chwileczkę…",
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { pendingText?: string; variant?: keyof typeof buttonStyles }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function TextField({
  label,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="h-12 rounded-xl border border-foreground/20 bg-background px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        {...props}
      />
    </div>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
        {success}
      </p>
    );
  }
  return null;
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white"
        >
          C
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </main>
  );
}
