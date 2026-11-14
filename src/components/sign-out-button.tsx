import { signOut } from "@/lib/auth/actions";
import { SubmitButton } from "./ui";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <SubmitButton variant="secondary" pendingText="Wylogowywanie…">
        Wyloguj się
      </SubmitButton>
    </form>
  );
}
