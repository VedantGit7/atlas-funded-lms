"use client";

import { SafeHtml } from "@/components/SafeHtml";
import { useAccountTheme } from "../account-settings/account-theme-context";

export function MfaQrCode({ qrCode }: { qrCode: string }) {
  const { classes } = useAccountTheme();
  const value = qrCode.trim();

  if (value.startsWith("data:image")) {
    return (
      <div className="flex justify-center overflow-hidden rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface)] p-4">
        <img
          src={value}
          alt="Scan this code with your authenticator app"
          className="h-44 w-44 max-w-full object-contain"
        />
      </div>
    );
  }
  if (value.startsWith("<svg") || value.startsWith("<?xml")) {
    return (
      <SafeHtml
        html={value}
        variant="svg"
        className={`flex justify-center overflow-hidden rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface)] p-4 [&>svg]:h-44 [&>svg]:w-44 [&>svg]:max-w-full ${classes.field}`}
      />
    );
  }
  return null;
}
