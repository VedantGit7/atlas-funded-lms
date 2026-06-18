"use client";

import { useState } from "react";
import type { z } from "zod";
import type { studioLessonDetailSchema } from "../../../server/lessons/lesson-schemas";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonSettingsFormProps = {
  lesson: StudioLessonDetail;
  editable: boolean;
  saving: boolean;
  onSave: (values: {
    title: string;
    description: string;
    videoProvider: string;
    videoUrl: string;
    durationSeconds: string;
  }) => void;
};

export function LessonSettingsForm({ lesson, editable, saving, onSave }: LessonSettingsFormProps) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? "");
  const [videoProvider, setVideoProvider] = useState(lesson.videoProvider ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [durationSeconds, setDurationSeconds] = useState(
    lesson.durationSeconds != null ? String(lesson.durationSeconds) : "",
  );

  return (
    <section className="space-y-4 rounded border p-4">
      <h2>Lesson settings</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span>Title</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            disabled={!editable || saving}
          />
        </label>
        <label className="space-y-1">
          <span>Duration (seconds)</span>
          <input
            className="w-full rounded border px-3 py-2"
            type="number"
            min={0}
            value={durationSeconds}
            onChange={(event) => {
              setDurationSeconds(event.target.value);
            }}
            disabled={!editable || saving}
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span>Description</span>
          <textarea
            className="min-h-24 w-full rounded border px-3 py-2"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            disabled={!editable || saving}
          />
        </label>
        <label className="space-y-1">
          <span>Video provider</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={videoProvider}
            onChange={(event) => {
              setVideoProvider(event.target.value);
            }}
            disabled={!editable || saving}
          >
            <option value="">None</option>
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="bunny">Bunny</option>
          </select>
        </label>
        <label className="space-y-1">
          <span>Video URL</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={videoUrl}
            onChange={(event) => {
              setVideoUrl(event.target.value);
            }}
            disabled={!editable || saving}
          />
        </label>
      </div>
      {editable ? (
        <button
          type="button"
          disabled={saving || !title.trim()}
          onClick={() => {
            onSave({ title, description, videoProvider, videoUrl, durationSeconds });
          }}
        >
          {saving ? "Saving…" : "Save lesson"}
        </button>
      ) : null}
    </section>
  );
}
