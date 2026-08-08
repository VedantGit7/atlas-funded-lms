"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Check, Trash2, X } from "lucide-react";
import { LearningPathBuilder } from "./LearningPathBuilder";
import { PathPublishButton } from "./PathPublishButton";
import {
  deleteLearningPath,
  formatLearningPathApiError,
  updateLearningPath,
} from "@atlas/contracts-modules/learning-paths/learning-path.api-client";
import type { z } from "zod";
import type { learningPathDetailResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";
import { serializeStepsForApi } from "../learning-path-step-utils";
import {
  STATUS_CONFIG,
  STATUS_LABELS,
  badgeClassName,
  panelClassName,
} from "../learning-path-studio-shared";

type PathDetail = z.infer<typeof learningPathDetailResponseSchema>["data"];

type StudioLearningPathDetailClientProps = {
  path: PathDetail;
};

export function StudioLearningPathDetailClient({ path }: StudioLearningPathDetailClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  async function handleSaveSteps(steps: PathDetail["steps"]) {
    setBusy(true);
    setError(null);

    try {
      await updateLearningPath(path.id, {
        steps: serializeStepsForApi(steps),
      });
      router.refresh();
    } catch (saveError) {
      setError(formatLearningPathApiError(saveError));
      throw saveError;
    } finally {
      setBusy(false);
    }
  }

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

  const checks = [
    { label: "Title", passed: Boolean(path.title.trim()) },
    {
      label: "Steps",
      passed: path.steps.length > 0,
      passText: `${String(path.steps.length)} configured`,
      failText: "Add at least one step",
    },
  ] as const;

  const allChecksPassed = checks.every((check) => check.passed);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          <LearningPathBuilder
            path={path}
            onSave={handleSave}
            onSaveSteps={handleSaveSteps}
            busy={busy}
            error={error}
          />
        </div>

        <div className="space-y-4">
          <div className={`${panelClassName} p-4`}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Publish checklist
            </h2>
            <div className="space-y-2">
              {checks.map((check) => (
                <div
                  key={check.label}
                  className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                >
                  <span className="text-sm text-[var(--admin-on-surface)]">{check.label}</span>
                  <span
                    className={`flex items-center gap-1 text-xs font-medium ${
                      check.passed
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {check.passed ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {"passText" in check && check.passed
                      ? check.passText
                      : "failText" in check && !check.passed
                        ? check.failText
                        : check.passed
                          ? "Complete"
                          : "Required"}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
                <span className="text-sm text-[var(--admin-on-surface)]">Status</span>
                <span
                  className={`${badgeClassName} ${STATUS_CONFIG[path.status] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
                >
                  {STATUS_LABELS[path.status] ?? path.status}
                </span>
              </div>
            </div>

            {allChecksPassed && path.status === "DRAFT" ? (
              <div className="mt-3 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/80 px-3 py-2.5 dark:border-green-900/50 dark:bg-green-950/30">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                    Ready to publish
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400/90">
                    All required fields are configured.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <PathPublishButton pathId={path.id} status={path.status} />
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/30 p-4 dark:border-red-900/40 dark:bg-red-950/20">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">
              Danger zone
            </h2>
            <p className="mb-3 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
              Delete this path permanently. Steps and gate configuration will be lost.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setShowDelete(true);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete path
            </button>
          </div>
        </div>
      </div>

      {showDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-path-title"
            className="w-full max-w-sm rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-lg motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <h2 id="delete-path-title" className="mb-2 text-lg font-bold text-[var(--admin-on-surface)]">
              Delete this path?
            </h2>
            <p className="mb-6 text-sm text-[var(--admin-on-surface-variant)]">
              This permanently removes the path, all steps, and gate configuration.
            </p>
            {error ? (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                }}
                disabled={busy}
                className="rounded-lg border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void handleDelete();
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? "Deleting..." : "Delete path"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
