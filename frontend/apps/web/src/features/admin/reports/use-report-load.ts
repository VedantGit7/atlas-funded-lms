"use client";

import { useEffect, useRef } from "react";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";

/** Server-loaded data older than this is refreshed when the page mounts. */
const SERVER_DATA_FRESH_MS = 10_000;

/** A report page's load. A soft load refreshes in place instead of showing the loading state. */
export type ReportLoad = (options?: { soft?: boolean }) => Promise<void>;

/**
 * Runs a report page's load whenever it changes, which is whenever its filters,
 * page or sort do. On mount it skips the load the server already did: `load`
 * is still the one the page rendered with, so the server data is that load's
 * result. Next reuses a page's server data on back and forward, so data older
 * than a few seconds is refreshed in place.
 *
 * `initial` must be read once (for example through `useState`), so later
 * renders cannot change it.
 */
export function useReportLoad(load: ReportLoad, initial: ReportInitialData<unknown> | null): void {
  const firstLoad = useRef(load);
  useEffect(() => {
    if (initial !== null && load === firstLoad.current) {
      if (Math.abs(Date.now() - initial.loadedAt) > SERVER_DATA_FRESH_MS) {
        void load({ soft: true });
      }
      return;
    }
    void load();
  }, [load, initial]);
}
