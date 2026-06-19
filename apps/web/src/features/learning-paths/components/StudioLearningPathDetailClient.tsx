"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LearningPathBuilder } from "../../../features/learning-paths/components/LearningPathBuilder";
import { PathPublishButton } from "../../../features/learning-paths/components/PathPublishButton";
import {
  deleteLearningPath,
  formatLearningPathApiError,
  updateLearningPath,
} from "../../../modules/learning-paths/learning-path.api-client";
import type { z } from "zod";
import type { learningPathDetailResponseSchema } from "../../../server/learning-paths/learning-path.schemas";

type PathDetail = z.infer<typeof learningPathDetailResponseSchema>["data"];

type StudioLearningPathDetailClientProps = {
  path: PathDetail;
};

export function StudioLearningPathDetailClient({ path }: StudioLearningPathDetailClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(payload: {
    title: string;
    description: string | null;
    pathType: PathDetail["pathType"];
    steps: PathDetail["steps"];
  }) {
    setBusy(true);
    setError(null);

    try {
      await updateLearningPath(path.id, {
        title: payload.title,
        description: payload.description,
        pathType: payload.pathType,
        steps: payload.steps,
      });
      router.refresh();
    } catch (saveError) {
      setError(formatLearningPathApiError(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this learning path?")) return;

    setBusy(true);
    setError(null);

    try {
      await deleteLearningPath(path.id);
      router.push("/studio/learning-paths");
      router.refresh();
    } catch (deleteError) {
      setError(formatLearningPathApiError(deleteError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <LearningPathBuilder path={path} onSave={handleSave} busy={busy} error={error} />
      <section className="rounded border p-4 space-y-3">
        <h2>Publish</h2>
        <PathPublishButton pathId={path.id} status={path.status} />
      </section>
      <section className="rounded border p-4 space-y-3">
        <h2>Validation</h2>
        <ul className="text-sm">
          <li>
            {path.steps.length > 0
              ? "At least one step configured."
              : "Add at least one step before publish."}
          </li>
          <li>Status: {path.status}</li>
        </ul>
      </section>
      <button type="button" onClick={() => void handleDelete()} disabled={busy}>
        Delete path
      </button>
    </div>
  );
}
