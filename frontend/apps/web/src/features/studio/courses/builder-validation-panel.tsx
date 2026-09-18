"use client";

import { Check, Info, Play, Rocket, ShieldCheck } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { builderHelperClassName, statusBannerClassName } from "./course-builder-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type BuilderValidationPanelProps = {
  course: CourseDetail;
  moduleCount: number;
  canPublish: boolean;
  onPublish: () => void;
  publishing: boolean;
  publishError: string | null;
};

type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  tone: "success" | "info" | "warning";
};

function ChecklistIcon({ tone }: { tone: ChecklistItem["tone"] }) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full";
  if (tone === "success") {
    return (
      <span className={`${base} bg-[var(--admin-success)]/15 text-[var(--admin-success)]`}>
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (tone === "warning") {
    return (
      <span className={`${base} bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]`}>
        <Info className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={`${base} bg-[var(--admin-primary)]/15 text-[var(--admin-primary)]`}>
      <Info className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}

export function BuilderValidationPanel({
  course,
  moduleCount,
  canPublish,
  onPublish,
  publishing,
  publishError,
}: BuilderValidationPanelProps) {
  const hasTitle = course.title.trim().length > 0;
  const hasModules = moduleCount > 0;
  const ready = hasTitle && hasModules && course.status === "DRAFT";

  const items: ChecklistItem[] = [
    {
      id: "title",
      label: "Title",
      detail: hasTitle ? "Complete" : "Add a course title",
      tone: hasTitle ? "success" : "warning",
    },
    {
      id: "modules",
      label: "Modules",
      detail: hasModules
        ? `${moduleCount} module${moduleCount === 1 ? "" : "s"} added`
        : "Add at least one module",
      tone: hasModules ? "success" : "warning",
    },
    {
      id: "status",
      label: "Status",
      detail:
        course.status === "DRAFT"
          ? "Draft — ready for review"
          : course.status === "REVIEW"
            ? "Awaiting reviewer approval"
            : course.status === "PUBLISHED"
              ? "Published and live"
              : "Archived",
      tone: course.status === "DRAFT" ? "info" : "info",
    },
  ];

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
          Publish Checklist
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <ChecklistIcon tone={item.tone} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{item.label}</p>
                <p
                  className={[
                    "text-xs font-medium",
                    item.tone === "success"
                      ? "text-[var(--admin-success)]"
                      : item.tone === "warning"
                        ? "text-[var(--admin-warning)]"
                        : "text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                >
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {publishError ? (
          <p
            role="alert"
            className={`${statusBannerClassName} mt-4 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
          >
            {publishError}
          </p>
        ) : null}

        {canPublish && course.status === "DRAFT" ? (
          <div className="mt-6 space-y-3">
            {ready ? (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 px-3 py-2.5">
                <ShieldCheck
                  className="h-5 w-5 shrink-0 text-[var(--admin-success)]"
                  aria-hidden="true"
                />
                <span className="text-xs font-bold text-[var(--admin-success)]">
                  Ready to submit for review
                </span>
              </div>
            ) : (
              <p className={builderHelperClassName}>
                Complete the checklist items above before submitting.
              </p>
            )}

            <button
              type="button"
              onClick={onPublish}
              disabled={!ready || publishing}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary-container)] px-4 py-3 text-sm font-bold text-[var(--admin-on-primary-container)] shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.98]"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              {publishing ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        ) : null}

        {course.status === "REVIEW" ? (
          <p className={`${builderHelperClassName} mt-6`}>
            This course is awaiting review and cannot be edited.
          </p>
        ) : null}

        {course.status === "PUBLISHED" ? (
          <p className={`${builderHelperClassName} mt-6`}>
            This course is published. Direct edits are locked.
          </p>
        ) : null}

        <div className="group relative mt-8 aspect-video cursor-pointer overflow-hidden rounded-xl border border-[var(--admin-border)]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={
              course.coverKey
                ? { backgroundImage: `url(${course.coverKey})` }
                : {
                    backgroundImage:
                      "linear-gradient(135deg, var(--admin-primary-strong), var(--admin-primary-container))",
                  }
            }
          />
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--admin-scrim)]/20 transition-colors group-hover:bg-[var(--admin-scrim)]/10">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--admin-surface)]/25 text-[var(--admin-on-primary)] backdrop-blur-md">
              <Play className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="absolute bottom-2 left-2 right-2">
            <span className="inline-block rounded bg-[var(--admin-scrim)]/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-primary)]">
              Preview course
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
