"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  formatGradingApiError,
  getGradingTask,
  gradeGradingTask,
  listGradingTasks,
  type GradingQueueItem,
  type GradingTaskDetail,
} from "../../grading/api";
import {
  managePrimaryButtonClassName,
  manageSearchInputClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
  manageTableCardClassName,
  manageTableHeadClassName,
  manageTableTdClassName,
  manageTableThClassName,
} from "./manage-ui-shared";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "GRADED", label: "Graded" },
];

function taskStatusTone(status: GradingQueueItem["status"]): "success" | "primary" | "neutral" {
  if (status === "GRADED") return "success";
  if (status === "IN_PROGRESS") return "primary";
  return "neutral";
}

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function ManageAnswerReviewsPanel() {
  const [tasks, setTasks] = useState<GradingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<GradingTaskDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listGradingTasks({
        assignedTo: "all",
        limit: 50,
        ...(statusFilter ? { status: statusFilter as "PENDING" | "IN_PROGRESS" | "GRADED" } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
      });
      setTasks(response.data);
    } catch (caught) {
      setError(formatGradingApiError(caught));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadTasks();
    }, 300);
    return () => {
      clearTimeout(handle);
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskDetail(null);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    setError(null);
    void getGradingTask(selectedTaskId)
      .then((response) => {
        if (!cancelled) setTaskDetail(response.data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(formatGradingApiError(caught));
          setTaskDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  function closeDrawer() {
    setSelectedTaskId(null);
    setTaskDetail(null);
  }

  async function handleGraded() {
    await loadTasks();
    closeDrawer();
  }

  return (
    <div className="space-y-5">
      {error && !selectedTaskId ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search by learner or assessment"
            aria-label="Search grading tasks"
            className={manageSearchInputClassName}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={STATUS_OPTIONS}
          ariaLabel="Filter by status"
          className="min-w-[10rem] border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--admin-on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading answer reviews…
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-16 text-center">
          <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No answer reviews</p>
          <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Manual grading tasks appear here when learners submit answers that require review.
          </p>
        </div>
      ) : (
        <div className={manageTableCardClassName}>
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className={manageTableHeadClassName}>
                  <th className={manageTableThClassName}>Assessment</th>
                  <th className={manageTableThClassName}>Learner</th>
                  <th className={manageTableThClassName}>Type</th>
                  <th className={manageTableThClassName}>Points</th>
                  <th className={manageTableThClassName}>Submitted</th>
                  <th className={manageTableThClassName}>Status</th>
                  <th className={`${manageTableThClassName} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0 transition-colors hover:bg-[var(--admin-surface-high)]"
                  >
                    <td className={`${manageTableTdClassName} font-semibold`}>
                      {task.assessmentTitle}
                    </td>
                    <td className={manageTableTdClassName}>{task.learnerDisplayName}</td>
                    <td className={manageTableTdClassName}>
                      <span className="rounded-md bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                        {task.itemType.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className={manageTableTdClassName}>{String(task.possiblePoints)}</td>
                    <td className={manageTableTdClassName}>
                      {formatSubmittedAt(task.submittedAt)}
                    </td>
                    <td className={manageTableTdClassName}>
                      <span className={manageStatusChipClassName(taskStatusTone(task.status))}>
                        {task.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className={manageTableTdClassName}>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTaskId(task.id);
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                        >
                          Evaluate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTaskId ? (
        <EvaluateDrawer
          taskId={selectedTaskId}
          task={taskDetail}
          loading={loadingDetail}
          error={error}
          onClose={closeDrawer}
          onGraded={() => {
            void handleGraded();
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function EvaluateDrawer({
  taskId,
  task,
  loading,
  error,
  onClose,
  onGraded,
  onError,
}: {
  taskId: string;
  task: GradingTaskDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onGraded: () => void;
  onError: (message: string) => void;
}) {
  const [score, setScore] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!task) return;
    setScore(task.existingGrade != null ? String(task.existingGrade.score) : "");
    setRemarks(task.existingGrade?.feedback ?? "");
  }, [task]);

  const isGraded = task?.status === "GRADED";

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!task || isGraded) return;

    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > task.possiblePoints) {
      onError(`Score must be between 0 and ${String(task.possiblePoints)}.`);
      return;
    }
    if (!remarks.trim()) {
      onError("Remarks are required.");
      return;
    }

    setSubmitting(true);
    onError("");
    try {
      await gradeGradingTask(task.id, {
        score: parsedScore,
        feedback: remarks.trim(),
      });
      onGraded();
    } catch (caught) {
      onError(formatGradingApiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end motion-safe:animate-[admin-fade-in_0.15s_ease-out]">
      <button
        type="button"
        aria-label="Close evaluate panel"
        className="absolute inset-0 bg-[var(--admin-scrim)]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="evaluate-drawer-title"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-slide-up_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Answer review
            </p>
            <h2
              id="evaluate-drawer-title"
              className="truncate text-lg font-bold text-[var(--admin-on-surface)]"
            >
              {task?.assessment.title ?? "Evaluate submission"}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[var(--admin-on-surface-variant)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading submission…
            </div>
          ) : !task ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Could not load task {taskId}.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                  {task.learner.displayName}
                </p>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  {task.answers.length} answer{task.answers.length === 1 ? "" : "s"} · max{" "}
                  {String(task.possiblePoints)} pts
                </p>
              </div>

              {task.answers.map((answer, index) => (
                <article
                  key={answer.assessmentItemId}
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Question {String(index + 1)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--admin-on-surface)]">
                    {answer.prompt}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--admin-on-surface-variant)]">
                    {formatAnswer(answer.learnerAnswer)}
                  </p>
                </article>
              ))}

              {error ? (
                <p role="alert" className="text-sm text-[var(--admin-danger)]">
                  {error}
                </p>
              ) : null}

              <form
                className="space-y-4 border-t border-[var(--admin-border)] pt-4"
                onSubmit={(event) => void handleSubmit(event)}
              >
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                    Points
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={task.possiblePoints}
                    step="0.01"
                    value={score}
                    onChange={(event) => {
                      setScore(event.target.value);
                    }}
                    disabled={isGraded || submitting}
                    className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-60"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                    Remarks
                  </span>
                  <textarea
                    rows={5}
                    value={remarks}
                    onChange={(event) => {
                      setRemarks(event.target.value);
                    }}
                    disabled={isGraded || submitting}
                    placeholder="Feedback for the learner"
                    className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-60"
                  />
                </label>
                {isGraded ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    This task has already been graded.
                  </p>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`${managePrimaryButtonClassName} w-full`}
                  >
                    {submitting ? "Submitting…" : "Submit grade"}
                  </button>
                )}
              </form>
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--admin-border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`${manageSecondaryButtonClassName} w-full`}
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}

function formatAnswer(value: unknown): string {
  if (value == null) return "No answer submitted.";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // Unserialisable (circular, BigInt): describe it rather than rendering the
    // literal text "[object Object]" to a reviewer.
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    return "[unrenderable answer]";
  }
}
