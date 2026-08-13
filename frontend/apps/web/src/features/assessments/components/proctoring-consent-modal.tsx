"use client";

type ProctoringConsentModalProps = {
  open: boolean;
  confirming: boolean;
  level: 1 | 2 | 3;
  onConfirm: () => void;
  onCancel: () => void;
};

function levelCopy(level: 1 | 2 | 3): { title: string; body: string } {
  switch (level) {
    case 1:
      return {
        title: "Integrity monitoring consent (L1)",
        body: "This assessment uses Level 1 monitoring. While you take the attempt, the platform may record advisory signals such as tab switches, window blur, fullscreen exits, and copy/cut/paste or context-menu actions.",
      };
    case 2:
      return {
        title: "Integrity monitoring consent (L2)",
        body: "This assessment uses Level 2 monitoring. In addition to L1 browser signals, the platform may request camera and microphone access to record advisory presence and audio-activity signals. If media is unavailable or permission is denied, monitoring degrades gracefully and does not block your attempt.",
      };
    case 3:
      return {
        title: "Integrity monitoring consent (L3)",
        body: "This assessment uses Level 3 monitoring. In addition to L1/L2 signals, the platform may run advisory identity verification before or during the attempt. Outcomes are advisory only and never auto-fail your attempt.",
      };
  }
}

export function ProctoringConsentModal({
  open,
  confirming,
  level,
  onConfirm,
  onCancel,
}: ProctoringConsentModalProps) {
  if (!open) return null;

  const copy = levelCopy(level);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="proctoring-consent-title"
        className="w-full max-w-lg rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-lg"
      >
        <h2
          id="proctoring-consent-title"
          className="text-xl font-semibold text-[var(--admin-on-surface)]"
        >
          {copy.title}
        </h2>
        <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">{copy.body}</p>
        <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">
          These signals are advisory only. They do not auto-fail your attempt. Graders may review
          them alongside your submission.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded border border-[var(--admin-border)] px-4 py-2 text-sm"
            disabled={confirming}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-[var(--admin-primary)] px-4 py-2 text-sm font-medium text-[var(--admin-on-primary)]"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? "Starting..." : "I understand, start attempt"}
          </button>
        </div>
      </div>
    </div>
  );
}
