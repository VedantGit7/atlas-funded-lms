"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { dismissToast, getToasts, subscribeToToasts } from "../../lib/feedback/toast-store";

export function AppToastViewport() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts, getToasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="admin-theme pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(100vw-2rem,24rem)] flex-col gap-2.5"
    >
      {toasts.map((item) => {
        const isSuccess = item.tone === "success";
        const Icon = isSuccess ? CheckCircle2 : XCircle;

        return (
          <div
            key={item.id}
            role="status"
            className={[
              "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm",
              isSuccess
                ? "border-[color-mix(in_srgb,var(--admin-success)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))]"
                : "border-[color-mix(in_srgb,var(--admin-danger)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))]",
              item.exiting
                ? "motion-safe:animate-[admin-toast-out_0.22s_ease-in_forwards]"
                : "motion-safe:animate-[admin-toast-in_0.28s_cubic-bezier(0.16,1,0.3,1)]",
            ].join(" ")}
          >
            <span
              className={[
                "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                isSuccess
                  ? "bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]"
                  : "bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))] text-[var(--admin-danger)]",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </span>

            <p
              className={[
                "min-w-0 flex-1 pt-0.5 text-sm font-semibold leading-snug",
                isSuccess ? "text-[var(--admin-success)]" : "text-[var(--admin-danger)]",
              ].join(" ")}
            >
              {item.message}
            </p>

            <button
              type="button"
              aria-label="Dismiss notification"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
              onClick={() => {
                dismissToast(item.id);
              }}
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
