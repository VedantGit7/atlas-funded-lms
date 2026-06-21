"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decideModerationCase,
  formatModerationError,
  getModerationCase,
  type ModerationCaseItem,
} from "../api";

type PendingDecision = {
  decisionKey: "actioned" | "rejected" | "closed";
  contentAction?: "delete";
  label: string;
};

export function ModerationCaseDetailClient({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<ModerationCaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (pendingDecision) {
      cancelRef.current?.focus();
    }
  }, [pendingDecision]);

  async function handleDecide(args: PendingDecision) {
    setBusy(true);
    setErrorMessage(null);

    try {
      await decideModerationCase(caseId, {
        decisionKey: args.decisionKey,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(args.contentAction ? { contentAction: args.contentAction } : {}),
      });
      setPendingDecision(null);
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
              Decision reason
            </label>
            <textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              className="mt-1 min-h-24 w-full rounded border px-3 py-2 text-sm"
              placeholder="Optional note for the decision record"
            />

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setPendingDecision({ decisionKey: "rejected", label: "Reject case" });
                }}
              >
                Reject case
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setPendingDecision({ decisionKey: "closed", label: "Close case" });
                }}
              >
                Close case
              </button>
              <button
                type="button"
                disabled={busy || detail.target?.deleted}
                className="rounded border border-red-700 px-3 py-2 text-sm text-red-700"
                onClick={() => {
                  setPendingDecision({
                    decisionKey: "actioned",
                    contentAction: "delete",
                    label: "Action and delete content",
                  });
                }}
              >
                Action and delete content
              </button>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </aside>

      {pendingDecision ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-decision-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 id="case-decision-confirm-title" className="font-semibold">
              Confirm decision
            </h2>
            <p className="mt-2 text-sm">
              {pendingDecision.contentAction === "delete"
                ? "Confirm deleting the reported content and recording this decision. This cannot be undone."
                : `Confirm ${pendingDecision.label.toLowerCase()}?`}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              <button
                type="button"
                disabled={busy}
                className={`rounded px-3 py-2 text-sm text-white ${
                  pendingDecision.contentAction === "delete" ? "bg-red-700" : "bg-neutral-900"
                }`}
                onClick={() => {
                  void handleDecide(pendingDecision);
                }}
              >
                Confirm
              </button>
              <button
                ref={cancelRef}
                type="button"
                disabled={busy}
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setPendingDecision(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
