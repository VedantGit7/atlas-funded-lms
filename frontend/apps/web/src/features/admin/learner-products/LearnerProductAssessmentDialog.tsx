"use client";

import { useEffect, useId, useState } from "react";
import { ListChecks, Save, X } from "lucide-react";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { LearnerProductItemsBuilder } from "./LearnerProductItemsBuilder";
import type { PickerCandidate } from "./learner-products-api";

type AssessmentDialogProps = {
  open: boolean;
  productTitle: string;
  currentAssessmentId: string | null;
  busy: boolean;
  error: string | null;
  onSubmit: (assessmentId: string) => void;
  onCancel: () => void;
};

/**
 * Repoints a mock test at a different assessment.
 *
 * A mock test has no contents list, so the contents page sends operators back
 * here — which only works if "here" can actually make the change. This is the
 * one caller of `PUT /mock-tests/:id/contents`.
 *
 * The picker itself is the shared items builder in single-selection mode, so
 * searching for an assessment behaves exactly as searching for a bundle item
 * does.
 */
export function LearnerProductAssessmentDialog({
  open,
  productTitle,
  currentAssessmentId,
  busy,
  error,
  onSubmit,
  onCancel,
}: AssessmentDialogProps) {
  const headingId = useId();
  const [selected, setSelected] = useState<PickerCandidate | null>(null);

  useEffect(() => {
    if (!open) return;

    setSelected(
      currentAssessmentId
        ? { id: currentAssessmentId, title: "Current assessment", subtitle: currentAssessmentId }
        : null,
    );

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, busy, onCancel, currentAssessmentId]);

  if (!open) return null;

  const changed = selected !== null && selected.id !== currentAssessmentId;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="min-w-0">
            <h2
              id={headingId}
              className="flex items-center gap-2 text-lg font-bold text-[var(--admin-on-surface)]"
            >
              <ListChecks className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
              Change assessment
            </h2>
            <p className="mt-0.5 truncate text-sm text-[var(--admin-on-surface-variant)]">
              {productTitle}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Learners already enrolled will sit the new assessment the next time they open this mock
            test.
          </p>

          <LearnerProductItemsBuilder
            type="mock-tests"
            items={[]}
            onChange={() => {
              // Single-selection mode never emits list changes.
            }}
            singleSelection={selected}
            onSingleSelectionChange={setSelected}
            disabled={busy}
            emptyHint="No assessment selected."
          />

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-danger)]"
            >
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={manageSecondaryButtonClassName}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !changed}
            onClick={() => {
              if (selected) onSubmit(selected.id);
            }}
            className={managePrimaryButtonClassName}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save assessment"}
          </button>
        </footer>
      </div>
    </div>
  );
}
