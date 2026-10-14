"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import type {
  ReportExportHistoryOf,
  ReportExportScheduleOf,
  ReportExportsApi,
  ReportExportsLedger,
  RetryReportExportBody,
} from "./admin-report-exports-api";

const POLL_INTERVAL_MS = 2500;
/** Server-loaded exports older than this are refreshed when the page mounts. */
const SERVER_DATA_FRESH_MS = 10_000;

function message(caught: unknown, fallback: string): string {
  return caught instanceof ClientApiError ? caught.message : fallback;
}

/**
 * Loads a report's exports, polls the runs still building, and runs every
 * action an exports page offers. Both exports page looks are built on it.
 */
export function useReportExports<TPayload extends ReportExportsLedger>(
  api: ReportExportsApi<TPayload>,
  options: {
    /** Hides the "file is ready" toast after this long; it stays until dismissed otherwise. */
    toastDismissMs?: number;
    /** Exports the server already loaded; the first browser load is skipped when present. */
    initialExports?: ReportInitialData<TPayload> | null | undefined;
  } = {},
) {
  type HistoryItem = ReportExportHistoryOf<TPayload>;
  type ScheduleItem = ReportExportScheduleOf<TPayload>;
  const { toastDismissMs } = options;

  // Read once: later renders must not reset what the page has changed since.
  const [initialExports] = useState(() => options.initialExports ?? null);
  const initialPayload = initialExports?.data ?? null;
  const [loading, setLoading] = useState(initialPayload === null);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<TPayload | null>(initialPayload);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<HistoryItem | null>(null);
  const statusRef = useRef<Map<string, HistoryItem["status"]>>(
    new Map(initialPayload?.history.map((item) => [item.id, item.status])),
  );

  const applyPayload = useCallback((next: TPayload) => {
    setPayload(next);
    for (const item of next.history) {
      if (!statusRef.current.has(item.id)) {
        statusRef.current.set(item.id, item.status);
      }
    }
  }, []);

  /** A soft load refreshes in place instead of showing the loading state. */
  const load = useCallback(
    async (loadOptions?: { soft?: boolean }) => {
      const soft = loadOptions?.soft === true;
      if (!soft) setLoading(true);
      setError(null);
      try {
        const response = await api.fetchExports();
        applyPayload(response.data);
      } catch (caught) {
        setError(message(caught, "Could not load exports."));
      } finally {
        if (!soft) setLoading(false);
      }
    },
    [api, applyPayload],
  );

  useEffect(() => {
    if (initialExports === null) {
      void load();
    } else if (Math.abs(Date.now() - initialExports.loadedAt) > SERVER_DATA_FRESH_MS) {
      // Back and forward reuse the server data from the first visit; refresh it in place.
      void load({ soft: true });
    }
  }, [load, initialExports]);

  const buildingIds = useMemo(
    () =>
      (payload?.history ?? [])
        .filter((item) => item.status === "QUEUED" || item.status === "RUNNING")
        .map((item) => item.id),
    [payload],
  );

  useEffect(() => {
    if (buildingIds.length === 0) return;
    const timer = window.setInterval(() => {
      void (async () => {
        for (const id of buildingIds) {
          try {
            const response = await api.fetchRun(id);
            const previousStatus = statusRef.current.get(id);
            statusRef.current.set(id, response.data.status);
            setPayload((current) => {
              if (!current) return current;
              const history = current.history.map((item) =>
                item.id === id ? response.data : item,
              );
              return { ...current, history };
            });
            if (
              response.data.status === "SUCCEEDED" &&
              (previousStatus === "QUEUED" || previousStatus === "RUNNING")
            ) {
              setToastRun(response.data);
            }
          } catch {
            // keep polling
          }
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [api, buildingIds]);

  useEffect(() => {
    if (!toastRun || toastDismissMs === undefined) return;
    const timer = window.setTimeout(() => {
      setToastRun(null);
    }, toastDismissMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toastRun, toastDismissMs]);

  /** Puts a new run at the top of the history, replacing the run it re-ran. */
  function addRun(run: HistoryItem, replacing?: string) {
    statusRef.current.set(run.id, run.status);
    setPayload((current) =>
      current
        ? {
            ...current,
            history: [run, ...current.history.filter((row) => row.id !== replacing)],
          }
        : current,
    );
    if (run.status === "SUCCEEDED") setToastRun(run);
  }

  async function download(item: HistoryItem) {
    if (!item.downloadAvailable) return;
    setBusyId(item.id);
    try {
      await api.download(item);
    } catch (caught) {
      setError(message(caught, "Could not download export."));
    } finally {
      setBusyId(null);
    }
  }

  /** Resolves true when the retry started. */
  async function retry(item: HistoryItem, body?: RetryReportExportBody): Promise<boolean> {
    setBusyId(item.id);
    try {
      const response = await api.retry(item.id, body);
      statusRef.current.set(response.data.id, response.data.status);
      setPayload((current) =>
        current
          ? {
              ...current,
              history: [response.data, ...current.history.filter((row) => row.id !== item.id)],
            }
          : current,
      );
      return true;
    } catch (caught) {
      setError(message(caught, "Could not retry export."));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSchedule(schedule: ScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await api.updateSchedule(schedule.id, { isActive: !schedule.isActive });
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: current.schedules.map((item) =>
                item.id === schedule.id ? response.data : item,
              ),
            }
          : current,
      );
    } catch (caught) {
      setError(message(caught, "Could not update schedule."));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSchedule(schedule: ScheduleItem) {
    setBusyId(schedule.id);
    try {
      await api.deleteSchedule(schedule.id);
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: current.schedules.filter((item) => item.id !== schedule.id),
            }
          : current,
      );
    } catch (caught) {
      setError(message(caught, "Could not delete schedule."));
    } finally {
      setBusyId(null);
    }
  }

  /** Resolves true when the schedule's run started. */
  async function runScheduleNow(schedule: ScheduleItem): Promise<boolean> {
    setBusyId(schedule.id);
    try {
      const response = await api.runScheduleNow(schedule.id);
      addRun(response.data.run);
      return true;
    } catch (caught) {
      setError(message(caught, "Could not run schedule."));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function created(run: HistoryItem, schedule: ScheduleItem | null) {
    addRun(run);
    if (schedule) {
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: [schedule, ...current.schedules.filter((item) => item.id !== schedule.id)],
            }
          : current,
      );
    }
  }

  return {
    loading,
    error,
    setError,
    payload,
    busyId,
    toastRun,
    dismissToast: () => {
      setToastRun(null);
    },
    load,
    download,
    retry,
    toggleSchedule,
    deleteSchedule,
    runScheduleNow,
    created,
  };
}

export type ReportExportsState<TPayload extends ReportExportsLedger> = ReturnType<
  typeof useReportExports<TPayload>
>;
