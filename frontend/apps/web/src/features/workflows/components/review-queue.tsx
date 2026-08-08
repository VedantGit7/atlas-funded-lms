"use client";

import { ArrowRight, ClipboardCheck } from "lucide-react";
import type { WorkflowQueueItem } from "../api";
import {
  TARGET_FILTER_OPTIONS,
  TARGET_TYPE_CONFIG,
  formatLifecycleState,
  formatRelativeSubmittedAt,
  formatTargetType,
  queueHeaderClassName,
  queueRowBaseClassName,
  queueRowIdleClassName,
  queueRowSelectedClassName,
  queueShellClassName,
  filterPillClassName,
  type TargetFilter,
} from "../review-studio-shared";

type ReviewQueueProps = {
  items: WorkflowQueueItem[];
  selectedId: string | null;
  targetFilter: TargetFilter;
  onTargetFilterChange: (value: TargetFilter) => void;
  onSelect: (id: string) => void;
};

export function ReviewQueue({
  items,
  selectedId,
  targetFilter,
  onTargetFilterChange,
  onSelect,
}: ReviewQueueProps) {
  if (items.length === 0) {
    return (
      <section className={queueShellClassName} aria-label="Review queue">
        <div className={queueHeaderClassName}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Pending tasks
            </span>
            <span className="rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--admin-on-surface-variant)]">
              0 items
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TARGET_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={filterPillClassName(targetFilter === option.value)}
                onClick={() => {
                  onTargetFilterChange(option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
          <ClipboardCheck
            className="mb-3 h-10 w-10 text-[var(--admin-on-surface-variant)] opacity-50"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">No pending reviews</h2>
          <p className="mt-2 max-w-xs text-sm text-[var(--admin-on-surface-variant)]">
            Items appear here when authors submit courses, assessments, or learning paths for
            publish approval.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={queueShellClassName} aria-label="Review queue">
      <div className={queueHeaderClassName}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Pending tasks
          </span>
          <span className="rounded bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-bold text-[var(--admin-primary)]">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TARGET_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={filterPillClassName(targetFilter === option.value)}
              onClick={() => {
                onTargetFilterChange(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.map((item) => {
          const selected = selectedId === item.id;
          const typeConfig = TARGET_TYPE_CONFIG[item.target.type];
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`${queueRowBaseClassName} ${selected ? queueRowSelectedClassName : queueRowIdleClassName}`}
                onClick={() => {
                  onSelect(item.id);
                }}
                aria-current={selected ? "true" : undefined}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    {item.target.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--admin-on-surface-variant)]">
                    {formatRelativeSubmittedAt(item.submittedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight ${typeConfig.className}`}
                  >
                    {typeConfig.shortLabel}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                    <span>{formatLifecycleState(item.fromState)}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-[var(--admin-primary)]">
                      {formatLifecycleState(item.toState)}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                  {formatTargetType(item.target.type)} · {item.target.status}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
