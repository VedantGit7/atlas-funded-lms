"use client";

import { useCallback, useEffect, useState } from "react";
import { competencyApiClient } from "@atlas/contracts-modules/competency/competency.api-client";
import type { z } from "zod";
import type { competencySignalDtoSchema } from "@atlas/contracts/competency/competency-projection.schemas";
import {
  alertErrorClassName,
  monoClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  tableHeadClassName,
} from "../competency-admin-shared";

type CompetencySignal = z.infer<typeof competencySignalDtoSchema>;

export function CompetencySignalTable() {
  const [signals, setSignals] = useState<CompetencySignal[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await competencyApiClient.listCompetencySignals({
        limit: 25,
        ...(cursor != null ? { cursor } : {}),
      });

      setSignals((current) =>
        cursor ? [...current, ...response.data.items] : response.data.items,
      );
      setNextCursor(response.data.pageInfo.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  return (
    <section className={panelClassName} aria-labelledby="signal-log-heading">
      <div className={panelHeaderClassName}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="signal-log-heading" className={panelEyebrowClassName}>
            Signal log
          </h2>
          {signals.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" aria-hidden="true" />
              {signals.length} loaded
            </span>
          ) : null}
        </div>
      </div>

      {loading && signals.length === 0 ? (
        <p className="p-5 text-sm text-[var(--admin-on-surface-variant)]">
          Loading competency signals…
        </p>
      ) : null}

      {error ? (
        <div className={`${alertErrorClassName} m-4 sm:m-5`} role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error && signals.length === 0 ? (
        <p className="p-5 text-sm text-[var(--admin-on-surface-variant)]">
          No competency signals recorded yet. Signals appear when learners complete scored
          activities.
        </p>
      ) : null}

      {signals.length > 0 ? (
        <>
          <div className="max-h-80 overflow-auto overscroll-contain">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">Recent competency signals</caption>
              <thead className="sticky top-0 z-10">
                <tr
                  className={`${tableHeadClassName} border-b border-[var(--admin-border)] shadow-sm`}
                >
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Timestamp
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dimension
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Raw score
                  </th>
                  <th scope="col" className="px-4 py-3 sm:pr-5">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {signals.map((signal) => (
                  <tr
                    key={signal.id}
                    className="transition-colors hover:bg-[var(--admin-surface-low)]"
                  >
                    <td className={`${monoClassName} whitespace-nowrap px-4 py-3 sm:px-5`}>
                      {new Date(signal.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                      {signal.dimensionKey}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--admin-primary)]">
                      {signal.signalSourceKey}
                    </td>
                    <td className={`${monoClassName} px-4 py-3`}>{signal.rawScore.toFixed(2)}</td>
                    <td className={`${monoClassName} px-4 py-3 sm:pr-5`}>
                      ×{signal.weight.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor ? (
            <div className="border-t border-[var(--admin-border)] px-4 py-3 sm:px-5">
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={loading}
                onClick={() => {
                  void loadPage(nextCursor);
                }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
