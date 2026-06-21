"use client";

import { useCallback, useEffect, useState } from "react";
import {
  decideModerationCase,
  formatModerationError,
  getModerationCase,
  type ModerationCaseItem,
} from "../api";

export function ModerationCaseDetailClient({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<ModerationCaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await getModerationCase(caseId);
      setDetail(response.data.items[0] ?? null);
    } catch (error) {
      setErrorMessage(formatModerationError(error));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleDecide(args: {
    decisionKey: "actioned" | "rejected" | "closed";
    contentAction?: "delete";
  }) {
    setBusy(true);
    setErrorMessage(null);

    try {
      await decideModerationCase(caseId, {
        decisionKey: args.decisionKey,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(args.contentAction ? { contentAction: args.contentAction } : {}),
      });
      setConfirmDelete(false);
      await loadDetail();
    } catch (error) {
      setErrorMessage(formatModerationError(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm opacity-80" aria-live="polite">
        Loading case detail…
      </p>
    );
  }

  if (errorMessage && !detail) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {errorMessage}
      </p>
    );
  }

  if (!detail) {
    return <p className="text-sm opacity-80">Case not found.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div className="rounded border p-4">
          <h2 className="text-lg font-semibold">Reported content</h2>
          <p className="mt-2 text-sm opacity-80">
            {detail.targetType} · {detail.targetId}
          </p>
          {detail.target?.title ? <p className="mt-2 font-medium">{detail.target.title}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {detail.target?.previewText ?? "Unavailable"}
          </p>
          {detail.target?.deleted ? (
            <p className="mt-2 text-sm text-red-700">Content has been deleted.</p>
          ) : null}
        </div>

        <div className="rounded border p-4">
          <h2 className="text-lg font-semibold">Decision history</h2>
          {detail.decisions?.length === 0 ? (
            <p className="mt-2 text-sm opacity-80">No decisions recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(detail.decisions ?? []).map((decision) => (
                <li key={decision.id} className="rounded border px-3 py-2">
                  <div className="font-medium">{decision.decisionKey}</div>
                  <div className="opacity-80">{decision.occurredAt}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded border p-4">
          <h2 className="font-semibold">Case metadata</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="opacity-70">Status</dt>
              <dd>{detail.status}</dd>
            </div>
            <div>
              <dt className="opacity-70">Reason</dt>
              <dd>{detail.reasonKey ?? "None"}</dd>
            </div>
          </dl>
        </div>

        {detail.status === "REVIEWING" ? (
          <div className="rounded border p-4">
            <h2 className="font-semibold">Decision controls</h2>
            <label htmlFor="decision-reason" className="mt-3 block text-sm">
              Reason
            </label>
            <textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              className="mt-1 min-h-24 w-full rounded border px-3 py-2 text-sm"
            />

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  void handleDecide({ decisionKey: "rejected" });
                }}
              >
                Reject case
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  void handleDecide({ decisionKey: "closed" });
                }}
              >
                Close case
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  disabled={busy || detail.target?.deleted}
                  className="rounded border border-red-700 px-3 py-2 text-sm text-red-700"
                  onClick={() => {
                    setConfirmDelete(true);
                  }}
                >
                  Action and delete content
                </button>
              ) : (
                <div className="space-y-2 rounded border border-red-700 p-3">
                  <p className="text-sm text-red-700">
                    Confirm deleting the reported content. This cannot be undone.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full rounded bg-red-700 px-3 py-2 text-sm text-white"
                    onClick={() => {
                      void handleDecide({ decisionKey: "actioned", contentAction: "delete" });
                    }}
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full rounded border px-3 py-2 text-sm"
                    onClick={() => {
                      setConfirmDelete(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
