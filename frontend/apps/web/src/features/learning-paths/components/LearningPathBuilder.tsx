"use client";

import { AlertCircle, GraduationCap, Map } from "lucide-react";
import type { z } from "zod";
import type { learningPathDetailResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  PATH_TYPE_CONFIG,
  cardSectionTitleClassName,
  inputClass,
  labelClass,
  panelClassName,
  sectionHeaderClassName,
  typeSegmentGroupClassName,
} from "../learning-path-studio-shared";
import type { PathStepDraft } from "../learning-path-step-utils";
import { PathStepSequencer } from "./PathStepSequencer";

type PathDetail = z.infer<typeof learningPathDetailResponseSchema>["data"];

type LearningPathBuilderProps = {
  path: PathDetail;
  onSave: (payload: {
    title: string;
    description: string | null;
    pathType: PathDetail["pathType"];
    steps: PathStepDraft[];
  }) => Promise<void>;
  onSaveSteps: (steps: PathStepDraft[]) => Promise<void>;
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
  onSaveSteps,
  busy = false,
  error = null,
}: LearningPathBuilderProps) {
  return (
    <div className="space-y-4 pb-1">
      <form
        className="space-y-4"
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
        {error ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}

        <div className={panelClassName}>
          <div className={sectionHeaderClassName}>
            <h2 className={cardSectionTitleClassName}>Path settings</h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="path-title">
                  Title *
                </label>
                <input
                  id="path-title"
                  name="title"
                  defaultValue={path.title}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <span className={labelClass}>Path type</span>
                <div className={typeSegmentGroupClassName} role="group" aria-label="Path type">
                  {(["program", "roadmap"] as const).map((type) => {
                    const cfg = PATH_TYPE_CONFIG[type];
                    const Icon = type === "program" ? GraduationCap : Map;
                    return (
                      <label key={type} className="cursor-pointer">
                        <input
                          type="radio"
                          name="pathType"
                          value={type}
                          defaultChecked={path.pathType === type}
                          className="peer sr-only"
                        />
                        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-[background-color,color,box-shadow] duration-200 hover:bg-[var(--admin-surface-high)] peer-checked:bg-[var(--admin-surface)] peer-checked:text-[var(--admin-primary)] peer-checked:shadow-sm">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {cfg.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="path-description">
                Description
              </label>
              <textarea
                id="path-description"
                name="description"
                defaultValue={path.description ?? ""}
                rows={4}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`${primaryButtonClassName} w-full justify-center py-2.5`}
            >
              {busy ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      </form>

      <PathStepSequencer
        pathId={path.id}
        steps={path.steps}
        onSaveSteps={onSaveSteps}
        busy={busy}
      />
    </div>
  );
}
