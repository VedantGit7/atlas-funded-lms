"use client";

import { useState } from "react";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import { inlineExpandClassName } from "../../studio/courses/admin-form-dropdown-shared";

const REVOKE_REASONS = [
  { value: "sharing", label: "Suspected sharing" },
  { value: "lost", label: "Lost or stolen" },
  { value: "upgrade", label: "Device upgrade" },
  { value: "other", label: "Other" },
] as const;

export type RevokeDeviceModalProps = {
  open: boolean;
  deviceLabel: string;
  learnerName: string;
  shortId: string;
  lastSeenLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string; notifyLearner: boolean }) => void;
};

const selectTriggerClassName =
  "h-10 w-full border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export function RevokeDeviceModal({
  open,
  deviceLabel,
  learnerName,
  shortId,
  lastSeenLabel,
  busy,
  onClose,
  onConfirm,
}: RevokeDeviceModalProps) {
  const [reason, setReason] = useState("");
  const [notifyLearner, setNotifyLearner] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revoke-device-title"
        className={`w-full max-w-[480px] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl ${inlineExpandClassName}`}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-6 py-4">
          <h2
            id="revoke-device-title"
            className="text-base font-semibold text-[var(--admin-on-surface)]"
          >
            Revoke this device?
          </h2>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-[var(--admin-on-surface)]">
              Revoke {deviceLabel} for {learnerName}?
            </p>
            <p className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              Last seen: {lastSeenLabel}
            </p>
          </div>

          <div className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-3">
            <TriangleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-on-surface)]">
              The learner will be signed out on this device immediately and will need to sign in
              again.
            </p>
          </div>

          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Device ID
                </span>
                <span className="mt-1 block font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {shortId}
                </span>
              </div>
              <div>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Last sync
                </span>
                <span className="mt-1 block font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {lastSeenLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label
                className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
                htmlFor="revoke-reason"
              >
                Reason
              </label>
              <Select
                id="revoke-reason"
                value={reason}
                onValueChange={setReason}
                options={[
                  { value: "", label: "Select a reason...", disabled: true },
                  ...REVOKE_REASONS.map((item) => ({ value: item.value, label: item.label })),
                ]}
                disabled={busy}
                className={selectTriggerClassName}
                placeholder="Select a reason..."
                ariaLabel="Revoke reason"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--admin-outline)] accent-[var(--admin-primary)]"
                checked={notifyLearner}
                disabled={busy}
                onChange={(event) => {
                  setNotifyLearner(event.target.checked);
                }}
              />
              <span className="text-sm text-[var(--admin-on-surface)]">
                Notify the learner by email
                <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                  Email notify is recorded for audit; delivery is not wired yet.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            className={`${ghostButtonClassName} uppercase tracking-[0.06em]`}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-10 min-w-[140px] items-center justify-center gap-2 rounded bg-[var(--admin-danger)] px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-danger)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !reason}
            onClick={() => {
              onConfirm({ reason, notifyLearner });
            }}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Revoking...
              </>
            ) : (
              "Revoke device"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
