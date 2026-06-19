"use client";

import { useCallback, useEffect, useState } from "react";
import { formatGradingApiError, listGradingTasks, type GradingQueueItem } from "./api";
import { GradingQueueTable } from "./components/grading-queue-table";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "GRADED", label: "Graded" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export function GradingQueueClient() {
  const [tasks, setTasks] = useState<GradingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

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
    void loadTasks();
  }, [loadTasks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="grading-status-filter" className="block text-sm font-medium">
            Status
          </label>
          <select
            id="grading-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
            }}
            className="mt-1 rounded border px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="grading-search" className="block text-sm font-medium">
            Search
          </label>
          <input
            id="grading-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Assessment or learner"
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm opacity-80" aria-live="polite">
          Loading grading queue…
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage ? <GradingQueueTable tasks={tasks} /> : null}
    </div>
  );
}
