import "server-only";
import { unstable_rethrow } from "next/navigation";
import { serverApi } from "../server-api";

/** The data a report page's server loaded for its first render, and when it did. */
export type ReportInitialData<T> = {
  data: T;
  /** Epoch milliseconds on the server. */
  loadedAt: number;
};

/** Server data for a page whose default date range is counted from today. */
export type ReportInitialDataInRange<T> = ReportInitialData<T> & {
  /** The date inputs (YYYY-MM-DD) the server counted, which the page starts on. */
  range: { from: string; to: string };
};

/**
 * Loads the data a report page shows first, on the server, so the page arrives
 * filled in instead of loading in the browser after hydration. Resolves null
 * when the load fails: the page then loads in the browser as it did before and
 * shows its own error and Retry.
 */
export async function loadReportInitialData<T>(path: string): Promise<ReportInitialData<T> | null> {
  try {
    const response = await serverApi.get<{ data: T }>(path);
    return { data: response.data, loadedAt: Date.now() };
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
