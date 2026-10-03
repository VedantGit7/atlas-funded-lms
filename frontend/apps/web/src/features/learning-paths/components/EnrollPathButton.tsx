"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  enrollInLearningPath,
  formatLearningPathApiError,
} from "@/modules/learning-paths/learning-path.api-client";

type EnrollPathButtonProps = {
  pathId: string;
  enrolled: boolean;
};

export function EnrollPathButton({ pathId, enrolled }: EnrollPathButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (enrolled) {
    return <p className="text-sm">You are enrolled in this path.</p>;
  }

  async function handleEnroll() {
    setBusy(true);
    setError(null);

    try {
      await enrollInLearningPath(pathId);
      router.refresh();
    } catch (enrollError) {
      setError(formatLearningPathApiError(enrollError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={() => void handleEnroll()} disabled={busy}>
        {busy ? "Enrolling..." : "Enroll in path"}
      </button>
    </div>
  );
}
