"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronRight, X } from "lucide-react";
import { builderHelperClassName } from "./course-builder-shared";
import {
  PRICING_PLAN_KIND_OPTIONS,
  type CoursePricingPlanKind,
} from "./course-pricing-plan-settings";

type ChoosePricingPlanDialogProps = {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (kind: CoursePricingPlanKind) => void;
};

export function ChoosePricingPlanDialog({
  open,
  disabled = false,
  onClose,
  onSelect,
}: ChoosePricingPlanDialogProps) {
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabled) {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [disabled, onClose, open]);

  if (!open) return null;

  return (
    <div className="admin-theme fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!disabled) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold text-[var(--admin-on-surface)]">
              Choose Pricing Plan
            </h2>
            <p className={`${builderHelperClassName} mt-1.5`}>
              Select a pricing plan you want to go ahead.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={disabled}
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <ul className="space-y-3">
            {PRICING_PLAN_KIND_OPTIONS.map((option) => {
              const isDeactivated = option.deactivated === true;

              return (
                <li key={option.kind}>
                  <button
                    type="button"
                    disabled={disabled || isDeactivated}
                    aria-disabled={isDeactivated}
                    className={[
                      "flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition-[border-color,background-color,transform] duration-200",
                      isDeactivated
                        ? "cursor-not-allowed border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] opacity-60"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)] motion-safe:active:scale-[0.995]",
                      disabled && !isDeactivated ? "cursor-not-allowed opacity-50" : "",
                    ].join(" ")}
                    onClick={() => {
                      if (disabled || isDeactivated) return;
                      onSelect(option.kind);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "text-sm font-semibold",
                            isDeactivated ? "text-[var(--admin-on-surface-variant)]" : "",
                          ].join(" ")}
                        >
                          {option.title}
                        </span>
                        {isDeactivated ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                            Unavailable
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={[
                          `${builderHelperClassName} mt-1 block leading-relaxed`,
                          isDeactivated ? "text-[var(--admin-on-surface-variant)]/80" : "",
                        ].join(" ")}
                      >
                        {option.description}
                      </span>
                    </span>
                    <ChevronRight
                      className={[
                        "mt-0.5 h-5 w-5 shrink-0",
                        isDeactivated
                          ? "text-[var(--admin-on-surface-variant)]/40"
                          : "text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
