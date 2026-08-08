"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock3,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  formatGradingApiError,
  gradeGradingTask,
  listGradingTasks,
  type GradingQueueItem,
  type GradingTaskDetail,
} from "../api";
import {
  GRADING_STATUS_CONFIG,
  cardSectionTitleClassName,
  formatLearnerAnswer,
  formatRelativeSubmittedAt,
  inputClass,
  itemTypeChipClassName,
  labelClass,
  learnerAvatarClassName,
  learnerInitials,
  outlineButtonClassName,
  panelClassName,
  panelHeaderEyebrowClassName,
  primaryButtonClassName,
  sectionHeaderClassName,
} from "../grading-studio-shared";

type GradingDetailPanelProps = {
  task: GradingTaskDetail;
};

function AnswerBody({ value }: { value: unknown }) {
  const formatted = formatLearnerAnswer(value);

  if (formatted.isCode) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4 font-mono text-xs leading-relaxed text-[var(--admin-on-surface)]">
        {formatted.text}
      </pre>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">{formatted.text}</p>
  );
}

export function GradingDetailPanel({ task }: GradingDetailPanelProps) {
  const router = useRouter();
  const scoreInputId = useId();
  const feedbackInputId = useId();
  const [score, setScore] = useState(
    task.existingGrade != null ? String(task.existingGrade.score) : "",
  );
  const [feedback, setFeedback] = useState(task.existingGrade?.feedback ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<GradingQueueItem[]>([]);

  const isGraded = task.status === "GRADED";
  const statusConfig = GRADING_STATUS_CONFIG[task.status];
  const proctoringFlags = task.proctoringTimeline.filter(
    (event) => event.severity === "HIGH" || event.severity === "MEDIUM",
  ).length;

  const remainingQueue = useMemo(
    () =>
      queueItems.filter(
        (item) => item.id !== task.id && (item.status === "PENDING" || item.status === "IN_PROGRESS"),
      ),
    [queueItems, task.id],
  );

  useEffect(() => {
    let cancelled = false;

    void listGradingTasks({ assignedTo: "me", limit: 25 })
      .then((response) => {
        if (!cancelled) setQueueItems(response.data);
      })
      .catch(() => {
        if (!cancelled) setQueueItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const handleSubmit = useCallback(async () => {
    if (submitting || isGraded) return;

    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > task.possiblePoints) {
      setErrorMessage(`Score must be between 0 and ${String(task.possiblePoints)}.`);
      return;
    }

    if (!feedback.trim()) {
      setErrorMessage("Feedback is required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await gradeGradingTask(task.id, {
        score: parsedScore,
        feedback: feedback.trim(),
      });
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatGradingApiError(error));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [feedback, isGraded, router, score, submitting, task.id, task.possiblePoints]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="mb-2 flex flex-wrap items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]"
          >
            <Link href="/studio/grading" className="inline-flex items-center gap-1 hover:text-[var(--admin-primary)]">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Grading queue
            </Link>
            <ChevronRight className="h-3 w-3 opacity-50" aria-hidden="true" />
            <span className="truncate text-[var(--admin-on-surface)]">{task.learner.displayName}</span>
          </nav>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Grading detail
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/assessments/${task.assessment.id}`} className={outlineButtonClassName}>
            Preview assessment
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className={`${panelClassName} p-5`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 gap-4">
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${learnerAvatarClassName(task.learner.displayName)}`}
                  aria-hidden="true"
                >
                  {learnerInitials(task.learner.displayName)}
                </span>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_18%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-warning)]">
                      {task.assessment.assessmentType.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Submitted {formatRelativeSubmittedAt(task.attempt.submittedAt)}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">
                    {task.assessment.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    Learner:{" "}
                    <span className="font-semibold text-[var(--admin-on-surface)]">
                      {task.learner.displayName}
                    </span>
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
                <Clock3 className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
                <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  Attempt {task.attempt.status.toLowerCase().replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`${panelClassName} border-l-4 ${proctoringFlags > 0 ? "border-l-[var(--admin-warning)]" : "border-l-[var(--admin-success)]"}`}
          >
            <div className={`${sectionHeaderClassName} px-5 py-4`}>
              <div className="flex items-center gap-2 text-[var(--admin-on-surface-variant)]">
                {proctoringFlags > 0 ? (
                  <ShieldAlert className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
                )}
                <h3 className={cardSectionTitleClassName}>Proctoring report</h3>
              </div>
              {proctoringFlags > 0 ? (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--admin-danger)]">
                  {String(proctoringFlags)} flag{proctoringFlags === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--admin-success)]">
                  Clear
                </span>
              )}
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <p className={panelHeaderEyebrowClassName}>Events recorded</p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface)]">
                  {task.proctoringTimeline.length > 0
                    ? `${String(task.proctoringTimeline.length)} timeline event${task.proctoringTimeline.length === 1 ? "" : "s"}`
                    : "No L1 proctoring events"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <p className={panelHeaderEyebrowClassName}>Severity flags</p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface)]">
                  {proctoringFlags > 0 ? `${String(proctoringFlags)} require review` : "None detected"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <p className={panelHeaderEyebrowClassName}>Report summary</p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  {task.proctoringReport?.summary ?? "No generated report for this attempt."}
                </p>
              </div>
            </div>
            {task.proctoringTimeline.length > 0 ? (
              <ul className="space-y-2 border-t border-[var(--admin-border)] px-5 py-4">
                {task.proctoringTimeline.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--admin-on-surface)]">{event.eventType}</p>
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        {event.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {new Date(event.occurredAt).toLocaleString()}
                    </p>
                    {event.summary ? (
                      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">{event.summary}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-4">
            {task.answers.map((answer, index) => (
              <article
                key={answer.assessmentItemId}
                className={`${panelClassName} transition-colors hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))]`}
              >
                <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                  <div className="min-w-0 max-w-[80%]">
                    <p className={panelHeaderEyebrowClassName}>
                      Question {String(index + 1)} · {answer.itemType.replaceAll("_", " ")}
                    </p>
                    <h4 className="mt-1 text-sm font-bold text-[var(--admin-on-surface)]">
                      {answer.prompt}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-bold text-[var(--admin-primary)]">
                      {answer.pointsAwarded != null ? String(answer.pointsAwarded) : "—"} /{" "}
                      {String(answer.possiblePoints)} pts
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <span className={itemTypeChipClassName}>{answer.itemType.replaceAll("_", " ")}</span>
                  <div className="mt-3">
                    <AnswerBody value={answer.learnerAnswer} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className={`${panelClassName} shadow-md`}>
            <div className={`${sectionHeaderClassName} bg-[var(--admin-surface-low)] px-4 py-3`}>
              <h3 className={cardSectionTitleClassName}>Final grading</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusConfig.className}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label htmlFor={scoreInputId} className={labelClass}>
                  Total assessment score
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id={scoreInputId}
                    type="number"
                    min={0}
                    max={task.possiblePoints}
                    step="0.01"
                    value={score}
                    onChange={(event) => {
                      setScore(event.target.value);
                    }}
                    disabled={isGraded || submitting}
                    className={`${inputClass} text-lg font-bold text-[var(--admin-primary)]`}
                  />
                  <span className="text-lg font-bold text-[var(--admin-on-surface-variant)]">
                    / {String(task.possiblePoints)}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor={feedbackInputId} className={labelClass}>
                  Instructor feedback
                </label>
                <textarea
                  id={feedbackInputId}
                  rows={6}
                  value={feedback}
                  onChange={(event) => {
                    setFeedback(event.target.value);
                  }}
                  disabled={isGraded || submitting}
                  placeholder={`Provide qualitative feedback for ${task.learner.displayName}…`}
                  className={`${inputClass} mt-2 min-h-[120px] resize-none`}
                  required
                />
              </div>

              {errorMessage ? (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {errorMessage}
                </div>
              ) : null}

              {isGraded ? (
                <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
                  This task has been graded and is locked.
                </p>
              ) : (
                <div className="space-y-2 border-t border-[var(--admin-border)] pt-4">
                  <button
                    type="button"
                    className={`${primaryButtonClassName} w-full`}
                    disabled={submitting}
                    onClick={() => {
                      setConfirmOpen(true);
                    }}
                  >
                    Finalize grade
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`${panelClassName} p-4`}>
            <h3 className={`${cardSectionTitleClassName} mb-3`}>
              Queue ({String(remainingQueue.length)} remaining)
            </h3>
            {remainingQueue.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No other pending tasks in your loaded queue.
              </p>
            ) : (
              <ul className="space-y-1">
                {remainingQueue.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/studio/grading/${item.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-[var(--admin-surface-low)]"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${GRADING_STATUS_CONFIG[item.status].dotClassName}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate font-medium text-[var(--admin-on-surface)]">
                        {item.learnerDisplayName}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {formatRelativeSubmittedAt(item.submittedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <AdminConfirmDialog
        open={confirmOpen}
        title="Finalize grade?"
        description={
          <>
            Submit score {score || "0"} / {String(task.possiblePoints)} with feedback for{" "}
            <span className="font-medium text-[var(--admin-on-surface)]">{task.learner.displayName}</span>.
            This action cannot be undone.
          </>
        }
        confirmLabel="Finalize grade"
        busyLabel="Submitting…"
        tone="primary"
        busy={submitting}
        error={confirmOpen ? errorMessage : null}
        onConfirm={() => {
          void handleSubmit();
        }}
        onCancel={() => {
          if (submitting) return;
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
