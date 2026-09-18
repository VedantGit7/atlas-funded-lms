"use client";

import { CheckCircle2, CircleDot, Pencil, RotateCcw, Send, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  panelHeaderEyebrowClassName,
  formatLifecycleState,
  formatSubmittedAt,
} from "../review-studio-shared";

type WorkflowHistoryItem = {
  id: string;
  fromState: string;
  toState: string;
  reason: string | null;
  occurredAt: string;
  action: "submit" | "approve" | "reject" | "return" | null;
};

type WorkflowHistoryPanelProps = {
  items: WorkflowHistoryItem[];
  loading?: boolean;
};

function historyIcon(action: WorkflowHistoryItem["action"]): LucideIcon {
  switch (action) {
    case "submit":
      return Send;
    case "approve":
      return CheckCircle2;
    case "reject":
      return XCircle;
    case "return":
      return RotateCcw;
    default:
      return Pencil;
  }
}

function historyTitle(item: WorkflowHistoryItem): string {
  switch (item.action) {
    case "submit":
      return "Submitted for review";
    case "approve":
      return "Approved and published";
    case "reject":
      return "Rejected";
    case "return":
      return "Returned for changes";
    default:
      return `${formatLifecycleState(item.fromState)} → ${formatLifecycleState(item.toState)}`;
  }
}

export function WorkflowHistoryPanel({ items, loading = false }: WorkflowHistoryPanelProps) {
  return (
    <section className="px-4 py-6 sm:px-6" aria-label="Workflow history">
      <h3 className={`${panelHeaderEyebrowClassName} mb-5 tracking-widest`}>Workflow history</h3>

      {loading ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading workflow history…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          No workflow transitions recorded for this item yet.
        </p>
      ) : (
        <ol className="relative space-y-6 border-l border-[var(--admin-border)] pl-8">
          {items.map((item, index) => {
            const Icon = historyIcon(item.action);
            const isLatest = index === items.length - 1;
            return (
              <li key={item.id} className="relative">
                <span
                  className={`absolute -left-[2.125rem] top-0.5 flex h-7 w-7 items-center justify-center rounded-full border ${
                    isLatest
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
                  } transition-transform duration-200 ease-out`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div>
                  <p
                    className={`text-sm font-medium ${isLatest ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface)]"}`}
                  >
                    {historyTitle(item)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                    {formatSubmittedAt(item.occurredAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--admin-on-surface-variant)]">
                      {formatLifecycleState(item.fromState)}
                    </span>
                    <CircleDot
                      className="h-3 w-3 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isLatest
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
                      }`}
                    >
                      {formatLifecycleState(item.toState)}
                    </span>
                  </div>
                  {item.reason ? (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                      {item.reason}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
