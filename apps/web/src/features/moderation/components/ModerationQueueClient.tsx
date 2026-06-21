"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  beginModerationReview,
  formatModerationError,
  listModerationCases,
  STATUS_OPTIONS,
  type ModerationCaseItem,
} from "../api";

export function ModerationQueueClient() {
  const [cases, setCases] = useState<ModerationCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listModerationCases({
        view: "cases",
        ...(status ? { status } : {}),
      });
      setCases(response.data.items);
    } catch (error) {
      setErrorMessage(formatModerationError(error));
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  async function handleBeginReview(caseId: string) {
    setBusyCaseId(caseId);
    setErrorMessage(null);

    try {
      await beginModerationReview(caseId);
      await loadCases();
    } catch (error) {
      setErrorMessage(formatModerationError(error));
    } finally {
      setBusyCaseId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="moderation-status-filter" className="block text-sm font-medium">
          Status
        </label>
        <select
          id="moderation-status-filter"
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

      {loading ? (
        <p className="text-sm opacity-80" aria-live="polite">
          Loading moderation queue…
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && cases.length === 0 ? (
        <p className="text-sm opacity-80">No moderation cases match the current filters.</p>
      ) : null}

      {!loading && !errorMessage && cases.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id} className="border-b align-top">
                    <td className="px-3 py-2">
                      <Link href={`/moderate/cases/${item.id}`} className="underline">
                        {item.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">
                      {item.targetType} · {item.targetId.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">{item.target?.previewText ?? "Unavailable"}</td>
                    <td className="px-3 py-2">
                      {item.status === "OPEN" ? (
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          disabled={busyCaseId === item.id}
                          onClick={() => {
                            void handleBeginReview(item.id);
                          }}
                        >
                          Begin review
                        </button>
                      ) : (
                        <Link href={`/moderate/cases/${item.id}`} className="text-xs underline">
                          Open
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {cases.map((item) => (
              <article key={item.id} className="rounded border p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/moderate/cases/${item.id}`} className="font-medium underline">
                    Case {item.id.slice(0, 8)}
                  </Link>
                  <span className="text-xs uppercase">{item.status}</span>
                </div>
                <p className="mt-2 text-sm opacity-80">
                  {item.targetType} · {item.target?.previewText ?? "Unavailable"}
                </p>
                {item.status === "OPEN" ? (
                  <button
                    type="button"
                    className="mt-3 rounded border px-3 py-2 text-sm"
                    disabled={busyCaseId === item.id}
                    onClick={() => {
                      void handleBeginReview(item.id);
                    }}
                  >
                    Begin review
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
