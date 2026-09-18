"use client";

import { useState } from "react";
import { clientApi } from "../../../lib/client-api";

type GamificationExport = {
  data: {
    exportedAt: string;
    rules: unknown;
    badges: unknown[];
    leaderboards: unknown[];
    quests: unknown[];
    rewards: { currencies: unknown[]; items: unknown[] };
    seasonalEvents: unknown[];
  };
};

/**
 * Downloads the whole gamification configuration as JSON.
 *
 * `GET /api/v1/gamification/export` has existed since the gamification domain
 * landed and nothing called it, so the configuration an admin spends real time
 * building — rules, badges, leaderboards, quests, rewards, seasonal events —
 * could not be taken out of the tenant at all. That matters for moving a setup
 * between environments and for keeping a copy before a destructive edit.
 */
export function GamificationExportButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    let url: string | null = null;
    try {
      const response = await clientApi.get<GamificationExport>("/api/v1/gamification/export");
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      url = URL.createObjectURL(blob);

      const stamp = response.data.exportedAt.slice(0, 10);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gamification-config-${stamp}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      setError("Export failed. Try again.");
    } finally {
      // Revoking in `finally` rather than after click(): the download is already
      // queued by then, and leaving it unrevoked leaks the blob for the life of
      // the document.
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        className="w-full rounded-lg border border-[color-mix(in_srgb,var(--admin-on-primary)_35%,transparent)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-primary)_12%,transparent)] disabled:opacity-60"
        disabled={busy}
        onClick={() => void handleExport()}
      >
        {busy ? "Exporting…" : "Export configuration"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
