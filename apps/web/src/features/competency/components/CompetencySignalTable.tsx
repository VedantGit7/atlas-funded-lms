"use client";

import { useCallback, useEffect, useState } from "react";
import { competencyApiClient } from "../../../modules/competency/competency.api-client";
import type { z } from "zod";
import type { competencySignalDtoSchema } from "../../../server/competency/competency-projection.schemas";

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

  if (loading && signals.length === 0) {
    return (
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Signal inspector</h2>
        <p className="text-sm opacity-80">Loading competency signals…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Signal inspector</h2>
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (signals.length === 0) {
    return (
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Signal inspector</h2>
        <p className="text-sm opacity-80">No competency signals recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded border p-4">
      <header>
        <h2 className="font-medium">Signal inspector</h2>
        <p className="text-sm opacity-80">Raw competency signals for this tenant.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2">Occurred</th>
              <th className="px-2 py-2">Dimension</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Raw score</th>
              <th className="px-2 py-2">Weight</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.id} className="border-b">
                <td className="px-2 py-2 whitespace-nowrap">
                  {new Date(signal.occurredAt).toLocaleString()}
                </td>
                <td className="px-2 py-2">{signal.dimensionKey}</td>
                <td className="px-2 py-2">{signal.signalSourceKey}</td>
                <td className="px-2 py-2">{signal.rawScore.toFixed(2)}</td>
                <td className="px-2 py-2">{signal.weight.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor ? (
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          disabled={loading}
          onClick={() => void loadPage(nextCursor)}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
