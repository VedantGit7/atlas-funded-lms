"use client";

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
};

export function WorkflowHistoryPanel({ items }: WorkflowHistoryPanelProps) {
  if (items.length === 0) {
    return (
      <section className="rounded border p-4" aria-label="Workflow history">
        <h2 className="text-lg font-medium">Workflow history</h2>
        <p className="text-sm opacity-80">No workflow history yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded border p-4" aria-label="Workflow history">
      <h2 className="text-lg font-medium">Workflow history</h2>
      <ol className="mt-3 space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.id} className="rounded border px-3 py-2">
            <p className="font-medium">
              {item.action ?? "transition"}: {item.fromState} → {item.toState}
            </p>
            <p className="text-xs opacity-70">{new Date(item.occurredAt).toLocaleString()}</p>
            {item.reason ? <p className="mt-1">{item.reason}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
