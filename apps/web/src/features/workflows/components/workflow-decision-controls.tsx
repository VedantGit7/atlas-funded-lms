"use client";

import { useState } from "react";
import type { WorkflowQueueItem } from "../api";
import { formatWorkflowApiError, transitionWorkflow } from "../api";

type WorkflowDecisionControlsProps = {
  item: WorkflowQueueItem | null;
  onCompleted: () => void;
};

export function WorkflowDecisionControls({ item, onCompleted }: WorkflowDecisionControlsProps) {
  const [comment, setComment] = useState("");
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "return" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!item) {
    return null;
  }

  async function handleAction(action: "approve" | "reject" | "return") {
    if (!item || pendingAction) return;

    if ((action === "reject" || action === "return") && comment.trim().length < 3) {
      setError("Comment is required for reject/return (minimum 3 characters).");
      return;
    }

    if (action === "approve" && !window.confirm("Approve and publish this course?")) {
      return;
    }

    setPendingAction(action);
    setError(null);

    try {
      await transitionWorkflow(item.id, {
        action,
        comment: comment.trim() ? comment.trim() : undefined,
      });
      setComment("");
      onCompleted();
    } catch (err) {
      setError(formatWorkflowApiError(err));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="space-y-4 rounded border p-4" aria-label="Workflow decision controls">
      <header>
        <h2 className="text-lg font-medium">Decision</h2>
        <p className="text-sm opacity-80">Approve, reject, or return with an optional comment.</p>
      </header>

      <label className="block space-y-1 text-sm">
        <span>Comment</span>
        <textarea
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
          }}
          rows={4}
          maxLength={2000}
          className="w-full rounded border px-3 py-2"
          placeholder="Required for reject/return"
        />
      </label>

      {error ? <p role="alert">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendingAction != null}
          onClick={() => {
            void handleAction("approve");
          }}
        >
          {pendingAction === "approve" ? "Approving..." : "Approve and publish"}
        </button>
        <button
          type="button"
          disabled={pendingAction != null}
          onClick={() => {
            void handleAction("return");
          }}
        >
          {pendingAction === "return" ? "Returning..." : "Return with comment"}
        </button>
        <button
          type="button"
          disabled={pendingAction != null}
          onClick={() => {
            void handleAction("reject");
          }}
        >
          {pendingAction === "reject" ? "Rejecting..." : "Reject with comment"}
        </button>
      </div>
    </section>
  );
}
