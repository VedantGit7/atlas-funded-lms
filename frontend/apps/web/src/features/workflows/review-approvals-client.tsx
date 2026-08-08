"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { formatWorkflowApiError, getWorkflowHistory, listWorkflows, type WorkflowQueueItem } from "./api";
import { ReviewDetailPanel } from "./components/review-detail-panel";
import { ReviewQueue } from "./components/review-queue";
import { WorkflowDecisionControls } from "./components/workflow-decision-controls";
import { WorkflowHistoryPanel } from "./components/workflow-history-panel";
import { detailPanelClassName, type TargetFilter } from "./review-studio-shared";

type HistoryItem = {
  id: string;
  fromState: string;
  toState: string;
  reason: string | null;
  occurredAt: string;
  action: "submit" | "approve" | "reject" | "return" | null;
};

type ReviewApprovalsClientProps = {
  initialItems?: WorkflowQueueItem[];
};

export function ReviewApprovalsClient({ initialItems = [] }: ReviewApprovalsClientProps) {
  const [items, setItems] = useState<WorkflowQueueItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await listWorkflows({
        status: "pending",
        ...(targetFilter === "all" ? {} : { targetType: targetFilter }),
      });
      setItems(response.data);
      setSelectedId((current) => {
        if (current && response.data.some((item) => item.id === current)) {
          return current;
        }
        return response.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(formatWorkflowApiError(err));
      setItems([]);
      setSelectedId(null);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [targetFilter]);

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setHistoryItems([]);
      setHistoryError(null);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    void getWorkflowHistory(selected.target.type, selected.target.id)
      .then((response) => {
        if (!cancelled) {
          setHistoryItems(response.data.items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(formatWorkflowApiError(err));
          setHistoryItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className="admin-theme text-[var(--admin-on-surface)]">
      <header className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--admin-on-surface)]">
          Review &amp; Approvals
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          Review pending courses, assessments, and learning paths awaiting publish approval.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Failed to load review queue. {error}</span>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-on-surface)]"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {loading ? (
        <div
          className="grid min-h-[28rem] gap-4 lg:grid-cols-[minmax(280px,35%)_minmax(0,1fr)]"
          aria-live="polite"
        >
          <div className="animate-pulse rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-4 h-4 w-24 rounded bg-[var(--admin-surface-high)]" />
            <div className="space-y-3">
              <div className="h-16 rounded bg-[var(--admin-surface-high)]" />
              <div className="h-16 rounded bg-[var(--admin-surface-high)]" />
            </div>
          </div>
          <div className="animate-pulse rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="h-8 w-2/3 rounded bg-[var(--admin-surface-high)]" />
            <div className="mt-6 h-24 rounded bg-[var(--admin-surface-high)]" />
          </div>
        </div>
      ) : (
        <div className="grid min-h-[calc(100dvh-18rem)] gap-4 lg:grid-cols-[minmax(280px,35%)_minmax(0,1fr)]">
          <ReviewQueue
            items={items}
            selectedId={selectedId}
            targetFilter={targetFilter}
            onTargetFilterChange={(filter) => {
              setNotice(null);
              setTargetFilter(filter);
            }}
            onSelect={(id) => {
              setNotice(null);
              setSelectedId(id);
            }}
          />

          <div className={detailPanelClassName}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ReviewDetailPanel item={selected} />
              {historyError ? (
                <p role="alert" className="px-4 pb-4 text-sm text-[var(--admin-danger)] sm:px-6">
                  Failed to load workflow history. {historyError}
                </p>
              ) : null}
              {selected ? <WorkflowHistoryPanel items={historyItems} loading={historyLoading} /> : null}
            </div>
            <WorkflowDecisionControls
              item={selected}
              onCompleted={(options) => {
                if (options?.stale) {
                  setNotice(
                    "This item was already reviewed. Refreshing the queue — check Studio if it still appears here.",
                  );
                }
                void refresh({ showLoading: false });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
