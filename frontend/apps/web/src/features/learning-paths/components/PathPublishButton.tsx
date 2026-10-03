"use client";

import { useState } from "react";
import {
  publishLearningPath,
  formatLearningPathApiError,
} from "@/modules/learning-paths/learning-path.api-client";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import { STATUS_CONFIG, STATUS_LABELS } from "../learning-path-studio-shared";

type PathPublishButtonProps = {
  pathId: string;
  status: string;
};

export function PathPublishButton({ pathId, status }: PathPublishButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setBusy(true);
    setError(null);

    try {
      await publishLearningPath(pathId, {});
    } catch (publishError) {
      setError(formatLearningPathApiError(publishError));
    } finally {
      setBusy(false);
    }
  }

  if (status !== "DRAFT") {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${STATUS_CONFIG[status] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
      >
        <span className="h-2 w-2 rounded-full bg-current opacity-70" aria-hidden="true" />
        {status === "PUBLISHED"
          ? "Published — live to learners"
          : `Status: ${STATUS_LABELS[status] ?? status}`}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          void handlePublish();
        }}
        disabled={busy}
        className={`${primaryButtonClassName} w-full justify-center py-2.5`}
      >
        {busy ? "Submitting..." : "Publish path"}
      </button>
    </div>
  );
}
