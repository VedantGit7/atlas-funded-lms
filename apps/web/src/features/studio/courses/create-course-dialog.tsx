"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type CreateCourseDialogProps = {
  onClose: () => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to create course.";
}

export function CreateCourseDialog({ onClose }: CreateCourseDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);

    try {
      const response = await clientApi.post<{ data: { id: string } }>(
        "/api/v1/courses",
        {
          title,
          description: description || null,
        },
        "course-create",
      );
      router.push(`/studio/courses/${response.data.id}`);
      router.refresh();
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-full max-w-lg space-y-4 rounded border bg-white p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <header className="space-y-1">
          <h2>Create course</h2>
          <p className="text-sm opacity-80">New courses start in draft state.</p>
        </header>

        {error ? <p role="alert">{error}</p> : null}

        <label className="block space-y-1">
          <span>Title</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            required
            maxLength={200}
          />
        </label>

        <label className="block space-y-1">
          <span>Description</span>
          <textarea
            className="w-full rounded border px-3 py-2"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            rows={4}
            maxLength={5000}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" disabled={busy || title.trim().length === 0}>
            {busy ? "Creating..." : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
