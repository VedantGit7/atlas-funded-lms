"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { useAccountTheme } from "../../account-settings/account-theme-context";

type ArchiveAccountCardProps = {
  initialArchivedAt: string | null;
};

type ArchiveResponse = { data: { archivedAt: string | null } };

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Something went wrong. Please try again.";
}

export function ArchiveAccountCard({ initialArchivedAt }: ArchiveAccountCardProps) {
  const { classes } = useAccountTheme();
  const [archivedAt, setArchivedAt] = useState(initialArchivedAt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggleArchive() {
    setBusy(true);
    setMessage(null);
    try {
      const path = archivedAt ? "/api/v1/me/unarchive" : "/api/v1/me/archive";
      const idempotencyPrefix = archivedAt ? "unarchive-account" : "archive-account";
      const response = await clientApi.post<ArchiveResponse>(path, {}, idempotencyPrefix);
      setArchivedAt(response.data.archivedAt);
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--acct-border)] p-6">
      <div>
        <h3 className={classes.sectionTitle}>Archive account</h3>
        <p className={classes.sectionDesc}>
          {archivedAt
            ? "Your account is archived. Reactivate any time. Your data, progress, and certificates stay intact."
            : "Archive your data while keeping your username reserved. Reversible any time."}
        </p>
      </div>
      <button
        type="button"
        className={archivedAt ? classes.primaryButton : classes.dangerOutlineButton}
        disabled={busy}
        onClick={() => void toggleArchive()}
      >
        {busy ? "Working…" : archivedAt ? "Reactivate account" : "Archive account"}
      </button>
      {message ? <p className={`${classes.helper} w-full`}>{message}</p> : null}
    </div>
  );
}
