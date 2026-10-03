"use client";

type SessionSummary = {
  totalItems: number;
  answeredCount: number;
  correctCount: number;
};

type SwipeSessionSummaryDialogProps = {
  open: boolean;
  summary: SessionSummary;
  onClose: () => void;
};

export function SwipeSessionSummaryDialog({
  open,
  summary,
  onClose,
}: SwipeSessionSummaryDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swipe-summary-title"
    >
      <div className="w-full max-w-md rounded bg-card p-6 shadow-lg">
        <h2 id="swipe-summary-title" className="text-xl font-semibold">
          Session complete
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Practice recorded. Your responses were saved.
        </p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Cards answered</dt>
            <dd>{summary.answeredCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Correct</dt>
            <dd>{summary.correctCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Total cards</dt>
            <dd>{summary.totalItems}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-muted-foreground">
          XP and streak totals will appear in a future update.
        </p>

        <button
          type="button"
          className="mt-6 w-full rounded bg-black px-4 py-2 text-white"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
