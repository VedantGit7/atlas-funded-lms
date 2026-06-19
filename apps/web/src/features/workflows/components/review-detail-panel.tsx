"use client";

import type { WorkflowQueueItem } from "../api";

type ReviewDetailPanelProps = {
  item: WorkflowQueueItem | null;
};

export function ReviewDetailPanel({ item }: ReviewDetailPanelProps) {
  if (!item) {
    return (
      <section className="rounded border p-4" aria-label="Review detail">
        <h2 className="text-lg font-medium">Preview</h2>
        <p className="text-sm opacity-80">Select a pending review item to inspect it.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded border p-4" aria-label="Review detail">
      <header>
        <h2 className="text-lg font-medium">{item.target.title}</h2>
        <p className="text-sm opacity-80">Course · {item.target.status}</p>
      </header>

      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">Target type</dt>
          <dd>Course</dd>
        </div>
        <div>
          <dt className="font-medium">Current state</dt>
          <dd>{item.toState}</dd>
        </div>
        <div>
          <dt className="font-medium">Submitted</dt>
          <dd>{new Date(item.submittedAt).toLocaleString()}</dd>
        </div>
        {item.comment ? (
          <div>
            <dt className="font-medium">Submission comment</dt>
            <dd>{item.comment}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
