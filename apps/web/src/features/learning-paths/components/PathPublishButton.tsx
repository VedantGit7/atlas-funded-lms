"use client";

import { useState } from "react";
import {
  publishLearningPath,
  formatLearningPathApiError,
} from "../../../modules/learning-paths/learning-path.api-client";

type PathPublishButtonProps = {
  pathId: string;
  status: string;
};

export function PathPublishButton({ pathId, status }: PathPublishButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (status !== "DRAFT") {
    return <p className="text-sm opacity-80">Current status: {status}</p>;
  }

  async function handlePublish() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await publishLearningPath(pathId, {});
      setMessage("Submitted for review.");
    } catch (publishError) {
      setError(formatLearningPathApiError(publishError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      <button type="button" onClick={() => void handlePublish()} disabled={busy}>
        {busy ? "Submitting..." : "Submit for review"}
      </button>
    </div>
  );
}
