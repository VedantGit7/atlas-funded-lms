"use client";

import type { WorkflowQueueItem } from "../api";

type ReviewQueueProps = {
  items: WorkflowQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ReviewQueue({ items, selectedId, onSelect }: ReviewQueueProps) {
  if (items.length === 0) {
    return (
      <section className="rounded border p-4" aria-label="Review queue">
        <h2 className="text-lg font-medium">Pending reviews</h2>
        <p className="text-sm opacity-80">No courses are awaiting review.</p>
      </section>
    );
  }

  return (
    <section className="rounded border" aria-label="Review queue">
      <header className="border-b px-4 py-3">
        <h2 className="text-lg font-medium">Pending reviews</h2>
        <p className="text-sm opacity-80">{items.length} item(s)</p>
      </header>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`w-full px-4 py-3 text-left hover:bg-neutral-50 ${
                selectedId === item.id ? "bg-neutral-100" : ""
              }`}
              onClick={() => {
                onSelect(item.id);
              }}
              aria-current={selectedId === item.id ? "true" : undefined}
            >
              <p className="font-medium">{item.target.title}</p>
              <p className="text-sm opacity-80">Course · {item.toState}</p>
              <p className="text-xs opacity-70">
                Submitted {new Date(item.submittedAt).toLocaleString()}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
