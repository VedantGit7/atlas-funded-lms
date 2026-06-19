"use client";

import { useCallback, useEffect, useState } from "react";
import { formatWorkflowApiError, listWorkflows, type WorkflowQueueItem } from "./api";
import { ReviewDetailPanel } from "./components/review-detail-panel";
import { ReviewQueue } from "./components/review-queue";
import { WorkflowDecisionControls } from "./components/workflow-decision-controls";
import { WorkflowHistoryPanel } from "./components/workflow-history-panel";

export function ReviewApprovalsClient() {
  const [items, setItems] = useState<WorkflowQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listWorkflows({ status: "pending", targetType: "course" });
      setItems(response.data);
      setSelectedId((current) => {
        if (current && response.data.some((item) => item.id === current)) {
          return current;
        }
        return response.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(formatWorkflowApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  if (loading) {
    return <p aria-live="polite">Loading review queue...</p>;
  }

  if (error) {
    return <p role="alert">Failed to load review queue. {error}</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <ReviewQueue items={items} selectedId={selectedId} onSelect={setSelectedId} />
      <div className="space-y-6">
        <ReviewDetailPanel item={selected} />
        <WorkflowHistoryPanel
          items={
            selected
              ? [
                  {
                    id: selected.id,
                    fromState: selected.fromState,
                    toState: selected.toState,
                    reason: selected.comment,
                    occurredAt: selected.submittedAt,
                    action: "submit",
                  },
                ]
              : []
          }
        />
        <WorkflowDecisionControls item={selected} onCompleted={() => void refresh()} />
      </div>
    </div>
  );
}
