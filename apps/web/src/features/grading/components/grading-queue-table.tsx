"use client";

import Link from "next/link";
import type { GradingQueueItem } from "../api";

type GradingQueueTableProps = {
  tasks: GradingQueueItem[];
};

function statusLabel(status: GradingQueueItem["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "IN_PROGRESS":
      return "In progress";
    case "GRADED":
      return "Graded";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function GradingQueueTable({ tasks }: GradingQueueTableProps) {
  if (tasks.length === 0) {
    return (
      <section className="rounded border p-6" aria-label="Grading queue">
        <h2 className="text-lg font-medium">No grading tasks</h2>
        <p className="text-sm opacity-80">
          Subjective submissions assigned to you will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded border" aria-label="Grading queue">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left">
            <tr>
              <th scope="col" className="px-4 py-3">
                Assessment
              </th>
              <th scope="col" className="px-4 py-3">
                Learner
              </th>
              <th scope="col" className="px-4 py-3">
                Item type
              </th>
              <th scope="col" className="px-4 py-3">
                Points
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/studio/grading/${task.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {task.assessmentTitle}
                  </Link>
                </td>
                <td className="px-4 py-3">{task.learnerDisplayName}</td>
                <td className="px-4 py-3">{task.itemType}</td>
                <td className="px-4 py-3">{task.possiblePoints}</td>
                <td className="px-4 py-3">{statusLabel(task.status)}</td>
                <td className="px-4 py-3">
                  {task.submittedAt ? new Date(task.submittedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
