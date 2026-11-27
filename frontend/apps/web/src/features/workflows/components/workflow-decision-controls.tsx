"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import type { WorkflowQueueItem } from "../api";
import { formatWorkflowApiError, transitionWorkflow } from "../api";
import {
  decisionFooterClassName,
  formatTargetType,
  inputClass,
  isStaleWorkflowConflictError,
  labelClass,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../review-studio-shared";

type WorkflowDecisionControlsProps = {
  item: WorkflowQueueItem | null;
  onCompleted: (options?: { stale?: boolean; action?: PendingAction }) => void;
};

type PendingAction = "approve" | "reject" | "return";

function successMessageForAction(item: WorkflowQueueItem, action: PendingAction): string {
  const label = item.target.title;
  const type = formatTargetType(item.target.type).toLowerCase();
  if (action === "approve") {
    return `${label} approved and published.`;
  }
  if (action === "reject") {
    return `${type} "${label}" rejected.`;
  }
  return `Change request sent for ${type} "${label}".`;
}

export function WorkflowDecisionControls({ item, onCompleted }: WorkflowDecisionControlsProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The dialogs portal into <body> only after mounting: checking `document`
  // during render made the server and browser HTML differ (a hydration error).
  const [mounted, setMounted] = useState(false);
  const actionInFlightRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const itemRef = useRef(item);

  itemRef.current = item;

  useEffect(() => {
    setComment("");
    setError(null);
    setConfirmAction(null);
    setPendingAction(null);
    actionInFlightRef.current = false;
  }, [item?.target.type, item?.target.id]);

  if (!item) {
    return null;
  }

  async function runAction(action: PendingAction) {
    const currentItem = itemRef.current;
    if (!currentItem || actionInFlightRef.current) return;

    if ((action === "reject" || action === "return") && comment.trim().length < 3) {
      setError("Add a review note (at least 3 characters) so the author knows what to change.");
      return;
    }

    actionInFlightRef.current = true;
    setPendingAction(action);
    setError(null);

    try {
      await transitionWorkflow(
        currentItem.id,
        {
          action,
          comment: comment.trim() ? comment.trim() : undefined,
        },
        { successMessage: successMessageForAction(currentItem, action) },
      );
      setComment("");
      setConfirmAction(null);
      onCompleted({ action });
      // The sidebar's "Review & Approvals" count is drawn by the server with
      // the page frame, which client navigation keeps; refresh it so it drops
      // as the queue empties (QA review 1 m8: it stayed at 2).
      router.refresh();
    } catch (err) {
      const message = formatWorkflowApiError(err);
      if (isStaleWorkflowConflictError(message)) {
        setConfirmAction(null);
        setComment("");
        setError(null);
        onCompleted({ stale: true, action });
        router.refresh();
        return;
      }
      setError(message);
    } finally {
      actionInFlightRef.current = false;
      setPendingAction(null);
    }
  }

  const busy = pendingAction != null;
  const modalError = confirmAction === "approve" ? error : null;
  const footerError = confirmAction === "approve" ? null : error;

  return (
    <>
      <footer className={decisionFooterClassName} aria-label="Workflow decision controls">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
          <div className="min-w-0 flex-1">
            {/* One rule, said once (QA review 1 m9: the label was marked
                required while the hint said optional). */}
            <label className={labelClass} htmlFor="review-justification">
              Review note
            </label>
            <textarea
              id="review-justification"
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
              }}
              rows={3}
              maxLength={2000}
              disabled={busy}
              aria-describedby="review-justification-help"
              className={`${inputClass} mt-1 resize-none`}
              placeholder="What should the author know or change?"
            />
            <p
              id="review-justification-help"
              className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]"
            >
              Needed to reject or request changes. Optional when you approve.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:shrink-0">
            {item.availableActions.includes("reject") ? (
              <button
                type="button"
                disabled={busy}
                className={`${outlineButtonClassName} border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] px-4 py-2.5 text-[var(--admin-danger)] hover:border-[var(--admin-danger)] hover:text-[var(--admin-danger)]`}
                onClick={() => {
                  void runAction("reject");
                }}
              >
                {pendingAction === "reject" ? "Rejecting…" : "Reject"}
              </button>
            ) : null}
            {item.availableActions.includes("return") ? (
              <button
                type="button"
                disabled={busy}
                className={`${outlineButtonClassName} px-4 py-2.5`}
                onClick={() => {
                  void runAction("return");
                }}
              >
                {pendingAction === "return" ? "Returning…" : "Request changes"}
              </button>
            ) : null}
            {item.availableActions.includes("approve") ? (
              <button
                type="button"
                disabled={busy}
                className={`${primaryButtonClassName} inline-flex items-center gap-2 px-5 py-2.5`}
                onClick={() => {
                  setError(null);
                  setConfirmAction("approve");
                }}
              >
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Approve &amp; publish…
              </button>
            ) : null}
          </div>
        </div>

        {footerError ? (
          <p role="alert" className="mt-3 text-sm text-[var(--admin-danger)]">
            {footerError}
          </p>
        ) : null}
      </footer>

      {mounted
        ? createPortal(
            <div className="admin-theme">
              <AdminConfirmDialog
                open={confirmAction === "approve"}
                title="Approve and publish?"
                description={
                  <>
                    This will approve the {formatTargetType(item.target.type).toLowerCase()}{" "}
                    <span className="font-semibold text-[var(--admin-on-surface)]">
                      {item.target.title || "Untitled"}
                    </span>{" "}
                    and publish it for learners.
                  </>
                }
                confirmLabel="Confirm publish"
                busyLabel="Publishing…"
                icon={BadgeCheck}
                tone="primary"
                busy={pendingAction === "approve"}
                error={modalError}
                onConfirm={() => {
                  void runAction("approve");
                }}
                onCancel={() => {
                  if (pendingAction !== "approve") {
                    setConfirmAction(null);
                    setError(null);
                  }
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
