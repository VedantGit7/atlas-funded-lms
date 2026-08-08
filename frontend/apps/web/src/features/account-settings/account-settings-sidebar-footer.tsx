"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { performAtlasLogout } from "../../lib/auth/perform-logout";

export function AccountSettingsSidebarFooter() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      const destination = await performAtlasLogout();
      router.push(destination);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        void handleLogout();
      }}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-[var(--acct-danger)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--acct-danger)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 motion-safe:active:scale-[0.98]"
    >
      <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" strokeWidth={2} />
      <span className="text-xs font-medium">{busy ? "Signing out…" : "Log out"}</span>
    </button>
  );
}
