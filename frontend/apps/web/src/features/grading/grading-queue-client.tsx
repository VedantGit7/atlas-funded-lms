"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Filter, Search } from "lucide-react";
import { formatGradingApiError, listGradingTasks, type GradingQueueItem } from "./api";
import { GradingQueueStats } from "./components/grading-queue-stats";
import { GradingQueueTable } from "./components/grading-queue-table";
import { computeQueueStats, secondaryButtonClassName } from "./grading-studio-shared";

const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "GRADED", label: "Graded" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export function GradingQueueClient({
  initialTasks = [],
}: {
  initialTasks?: GradingQueueItem[];
}) {
  const [tasks, setTasks] = useState<GradingQueueItem[]>(initialTasks);
  const [loading, setLoading] = useState(initialTasks.length === 0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const skipInitialFetch = useRef(initialTasks.length > 0);

  const stats = useMemo(() => computeQueueStats(tasks), [tasks]);
  const headerCaption =
    stats.total === 0
      ? "No submissions are waiting for manual grading yet."
      : stats.actionable > 0
        ? `${String(stats.actionable)} pending assessment${stats.actionable === 1 ? "" : "s"} require your attention.`
        : "All loaded tasks in your queue have been graded.";

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listGradingTasks({
        assignedTo: "me",
        ...(status ? { status: status as "PENDING" | "IN_PROGRESS" | "GRADED" | "CANCELLED" } : {}),
        ...(search.trim() ? { q: search.trim() } : {}),
      });
      setTasks(response.data);
    } catch (error) {
      setErrorMessage(formatGradingApiError(error));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    void loadTasks();
  }, [loadTasks]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Grading Queue
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{headerCaption}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <label className="flex items-center gap-2 border-r border-[var(--admin-border)] px-3 py-2">
              <span className="sr-only">Filter by status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                }}
                className="bg-transparent text-xs font-semibold text-[var(--admin-on-surface-variant)] outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[12rem] items-center gap-2 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
              <span className="sr-only">Search assessments or learners</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Search queue…"
                className="w-full bg-transparent text-xs font-medium text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
              />
            </label>
          </div>
          <button
            type="button"
            className={`${secondaryButtonClassName} inline-flex items-center gap-2 px-3 py-2 text-xs`}
            onClick={() => {
              void loadTasks();
            }}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage ? <GradingQueueStats tasks={tasks} /> : null}

      {loading ? (
        <div
          className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm"
          aria-live="polite"
        >
          <div className="animate-pulse space-y-3 p-6">
            <div className="h-4 w-40 rounded bg-[var(--admin-surface-high)]" />
            <div className="h-10 rounded bg-[var(--admin-surface-high)]" />
            <div className="h-10 rounded bg-[var(--admin-surface-high)]" />
            <div className="h-10 rounded bg-[var(--admin-surface-high)]" />
          </div>
        </div>
      ) : null}

      {!loading && !errorMessage ? <GradingQueueTable tasks={tasks} /> : null}
    </div>
  );
}
