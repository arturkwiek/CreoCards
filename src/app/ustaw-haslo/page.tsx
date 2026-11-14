import type { Metadata } from "next";
import { AuthCard } from "@/components/ui";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Ustaw hasło – CreoCards" };

export default function SetPasswordPage() {
  return (
    <AuthCard title="Ustaw hasło">
      <p className="text-sm text-foreground/70">
        Co najmniej {PASSWORD_MIN_LENGTH} znaków, w tym litera i cyfra.
      </p>
      <SetPasswordForm />
    </AuthCard>
  );
}
