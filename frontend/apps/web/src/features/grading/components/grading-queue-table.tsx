"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import type { GradingQueueItem } from "../api";
import {
  GRADING_STATUS_CONFIG,
  formatRelativeSubmittedAt,
  isUrgentTask,
  itemTypeChipClassName,
  learnerAvatarClassName,
  learnerInitials,
  monoValueClassName,
  rowActionLabel,
  tableHeaderClassName,
  tableRowClassName,
  tableRowMutedClassName,
  tableRowUrgentClassName,
  tableShellClassName,
} from "../grading-studio-shared";

type GradingQueueTableProps = {
  tasks: GradingQueueItem[];
};

function StatusBadge({ status }: { status: GradingQueueItem["status"] }) {
  const config = GRADING_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${config.className}`}
    >
      <span
        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${config.dotClassName}`}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

export function GradingQueueTable({ tasks }: GradingQueueTableProps) {
  const router = useRouter();

  if (tasks.length === 0) {
    return (
      <section
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-14 text-center"
        aria-label="Grading queue"
      >
        <ClipboardList
          className="mb-3 h-10 w-10 text-[var(--admin-on-surface-variant)] opacity-50"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
          No grading tasks yet
        </h2>
        <p className="mt-2 max-w-lg text-sm text-[var(--admin-on-surface-variant)]">
          Tasks appear here when a learner submits an assessment you authored that includes items
          requiring manual review (short answer, long answer, file upload, assignment, or other
          non-auto-scored types).
        </p>
        <ul className="mt-4 max-w-lg space-y-2 text-left text-sm text-[var(--admin-on-surface-variant)]">
          <li>1. Publish the assessment so learners can attempt it.</li>
          <li>2. Have a learner complete and submit the attempt.</li>
          <li>3. The task is assigned to you as the assessment author.</li>
        </ul>
      </section>
    );
  }

  return (
    <section className={tableShellClassName} aria-label="Grading queue">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className={tableHeaderClassName}>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Assessment
              </th>
              <th scope="col" className="px-4 py-3">
                Learner
              </th>
              <th scope="col" className="hidden px-4 py-3 md:table-cell">
                Item type
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Points
              </th>
              <th scope="col" className="hidden px-4 py-3 sm:table-cell">
                Submitted
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const urgent = isUrgentTask(task);
              const muted = task.status === "CANCELLED";
              const actionLabel = rowActionLabel(task.status);

              return (
                <tr
                  key={task.id}
                  className={`${tableRowClassName} ${urgent ? tableRowUrgentClassName : ""} ${muted ? tableRowMutedClassName : ""}`}
                  tabIndex={0}
                  onClick={() => {
                    router.push(`/studio/grading/${task.id}`);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/studio/grading/${task.id}`);
                    }
                  }}
                >
                  <td className="px-4 py-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/studio/grading/${task.id}`}
                      className="font-semibold text-[var(--admin-on-surface)] underline-offset-2 hover:text-[var(--admin-primary)] hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {task.assessmentTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${learnerAvatarClassName(task.learnerDisplayName)}`}
                        aria-hidden="true"
                      >
                        {learnerInitials(task.learnerDisplayName)}
                      </span>
                      <span className="text-[var(--admin-on-surface)]">
                        {task.learnerDisplayName}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-4 md:table-cell">
                    <span className={itemTypeChipClassName}>
                      {task.itemType.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className={`px-4 py-4 text-right ${monoValueClassName}`}>
                    {task.possiblePoints}
                  </td>
                  <td className="hidden px-4 py-4 text-[var(--admin-on-surface-variant)] sm:table-cell">
                    {formatRelativeSubmittedAt(task.submittedAt)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {task.status === "CANCELLED" ? (
                      <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                        {actionLabel}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1 text-xs font-bold text-[var(--admin-primary)] opacity-0 shadow-sm transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[var(--admin-primary)] hover:text-[var(--admin-on-primary)]">
                        {actionLabel}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
          Showing {String(tasks.length)} result{tasks.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            disabled
            className="rounded-lg border border-[var(--admin-border)] p-1.5 text-[var(--admin-on-surface-variant)] opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="rounded-lg bg-[var(--admin-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)]">
            1
          </span>
          <button
            type="button"
            disabled
            className="rounded-lg border border-[var(--admin-border)] p-1.5 text-[var(--admin-on-surface-variant)] opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
