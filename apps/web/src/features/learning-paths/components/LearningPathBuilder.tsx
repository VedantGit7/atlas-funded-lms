"use client";

import type { z } from "zod";
import type { learningPathDetailResponseSchema } from "../../../server/learning-paths/learning-path.schemas";
import { PathGateEditor } from "./PathGateEditor";

type PathDetail = z.infer<typeof learningPathDetailResponseSchema>["data"];
type StepDraft = PathDetail["steps"][number];

type LearningPathBuilderProps = {
  path: PathDetail;
  onSave: (payload: {
    title: string;
    description: string | null;
    pathType: PathDetail["pathType"];
    steps: StepDraft[];
  }) => Promise<void>;
  busy?: boolean;
  error?: string | null;
};

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function LearningPathBuilder({
  path,
  onSave,
  busy = false,
  error = null,
}: LearningPathBuilderProps) {
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        void onSave({
          title: readFormString(formData, "title") || path.title,
          description: readFormString(formData, "description") || null,
          pathType: (readFormString(formData, "pathType") ||
            path.pathType) as PathDetail["pathType"],
          steps: path.steps,
        });
      }}
    >
      {error ? <p role="alert">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span>Title</span>
          <input
            name="title"
            defaultValue={path.title}
            className="w-full rounded border px-3 py-2"
            required
          />
        </label>
        <label className="block space-y-1">
          <span>Path type</span>
          <select
            name="pathType"
            defaultValue={path.pathType}
            className="w-full rounded border px-3 py-2"
          >
            <option value="program">Program</option>
            <option value="roadmap">Roadmap</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span>Description</span>
        <textarea
          name="description"
          defaultValue={path.description ?? ""}
          className="w-full rounded border px-3 py-2"
          rows={4}
        />
      </label>

      <section className="space-y-3">
        <h2 className="font-medium">Steps</h2>
        {path.steps.length === 0 ? (
          <p className="text-sm opacity-80">
            Add steps in the path editor to sequence learner progress.
          </p>
        ) : (
          <ol className="space-y-3">
            {path.steps.map((step) => (
              <li key={step.id} className="rounded border p-4">
                <p className="font-medium">
                  {step.position}. {step.title}
                </p>
                <p className="text-sm opacity-80">
                  {step.stepType}
                  {step.refId ? ` · ${step.refId}` : ""}
                </p>
                <PathGateEditor gates={step.gates} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <button type="submit" disabled={busy}>
        {busy ? "Saving..." : "Save path"}
      </button>
    </form>
  );
}
