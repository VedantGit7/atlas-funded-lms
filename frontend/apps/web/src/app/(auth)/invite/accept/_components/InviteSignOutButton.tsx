"use client";

import { useState } from "react";
import { performAtlasLogout } from "@/lib/auth/perform-logout";

type InviteSignOutButtonProps = Readonly<{
  redirectTo: string;
}>;

export function InviteSignOutButton({ redirectTo }: InviteSignOutButtonProps) {
  const [pending, setPending] = useState(false);

  function handleSignOut(): void {
    setPending(true);
    void performAtlasLogout({ redirectTo })
      .then((next) => {
        window.location.assign(next);
      })
      .catch(() => {
        setPending(false);
      });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleSignOut}
      className="flex w-full items-center justify-center rounded-[10px] border-[1.5px] border-[var(--fba-red)]/40 bg-[var(--fba-surf)] px-4 py-3 text-[14px] font-semibold text-[var(--fba-red)] transition-colors hover:bg-[var(--fba-red)]/10 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Signing out..." : "Sign out and continue"}
    </button>
  );
}
