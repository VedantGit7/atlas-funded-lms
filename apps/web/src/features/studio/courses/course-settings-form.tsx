"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "../../../server/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsFormProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save course.";
}

export function CourseSettingsForm({ course, editable, onSaved }: CourseSettingsFormProps) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!editable) return;

    setBusy(true);
    setError(null);

    try {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          title,
          description: description || null,
        },
        "course-update",
      );
      onSaved(response.data);
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4 rounded border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <header>
        <h2>Course settings</h2>
        {!editable ? (
          <p className="text-sm opacity-80">This course is locked while in review or published.</p>
        ) : null}
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
          disabled={!editable || busy}
          required
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
          disabled={!editable || busy}
          rows={6}
        />
      </label>

      {editable ? (
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save settings"}
        </button>
      ) : null}
    </form>
  );
}
