"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type DeleteLessonDialogProps = {
  open: boolean;
  lessonId: string;
  courseId: string;
  onClose: () => void;
};

export function DeleteLessonDialog({ open, lessonId, courseId, onClose }: DeleteLessonDialogProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/lessons/${lessonId}`, "lesson-delete");
      router.push(`/studio/courses/${courseId}`);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof ClientApiError ? deleteError.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded bg-white p-6 shadow">
        <h2>Delete lesson?</h2>
        <p>This removes the lesson from the course builder. Progress records are preserved.</p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={() => void confirmDelete()} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
