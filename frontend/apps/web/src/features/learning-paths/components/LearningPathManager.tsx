"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  GraduationCap,
  Lock,
  Map,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import {
  createLearningPath,
  formatLearningPathApiError,
} from "@/modules/learning-paths/learning-path.api-client";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  PATH_TYPE_CONFIG,
  STATUS_CONFIG,
  STATUS_LABELS,
  badgeClassName,
  inputClass,
  labelClass,
  panelClassName,
  secondaryButtonClassName,
  sectionHeaderClassName,
  typeSegmentButtonClassName,
  typeSegmentGroupClassName,
} from "../learning-path-studio-shared";

type StudioLearningPathsPageProps = {
  paths: Array<{
    id: string;
    title: string;
    status: string;
    pathType: string;
    updatedAt: string;
  }>;
};

const INFO_CARDS = [
  {
    icon: BarChart3,
    title: "Performance tracking",
    description: "Paths include automatic drop-off analysis and step completion metrics.",
  },
  {
    icon: Lock,
    title: "Smart gates",
    description: "Enforce assessments or wait times before unlocking subsequent modules.",
  },
  {
    icon: Sparkles,
    title: "Dynamic progression",
    description: "Branch paths based on learner scores or previous financial experience.",
  },
] as const;

export function LearningPathManager({ paths }: StudioLearningPathsPageProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pathType, setPathType] = useState<"roadmap" | "program">("program");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);

    try {
      const created = await createLearningPath({ title, pathType });
      router.push(`/studio/learning-paths/${created.data.id}`);
      router.refresh();
    } catch (createError) {
      setError(formatLearningPathApiError(createError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Create bar — same pattern as Item Bank filter row */}
      <div className={`${panelClassName} p-4`}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
          New path
        </p>
        {error ? (
          <div
            role="alert"
            className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-[200px] max-w-full flex-1 md:max-w-md">
            <label className={labelClass} htmlFor="new-path-title">
              Title
            </label>
            <input
              id="new-path-title"
              className={inputClass}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              placeholder="e.g. Funded Trader Certification"
            />
          </div>
          <div className="shrink-0">
            <span className={labelClass}>Type</span>
            <div className={typeSegmentGroupClassName} role="group" aria-label="Path type">
              {(["program", "roadmap"] as const).map((type) => {
                const cfg = PATH_TYPE_CONFIG[type];
                const Icon = type === "program" ? GraduationCap : Map;
                const isSelected = pathType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setPathType(type);
                    }}
                    className={typeSegmentButtonClassName(isSelected)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleCreate();
            }}
            disabled={busy || !title.trim()}
            className={`${primaryButtonClassName} md:ml-auto`}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {busy ? "Creating..." : "Create path"}
          </button>
        </div>
      </div>

      {/* Paths list — same pattern as Item Bank table card */}
      <div className={panelClassName}>
        <div className={sectionHeaderClassName}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            Learning paths
          </h2>
          <span className="text-sm text-[var(--admin-on-surface-variant)]">
            {paths.length} {paths.length === 1 ? "path" : "paths"}
          </span>
        </div>

        {paths.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))]">
              <BookOpen className="h-7 w-7 text-[var(--admin-primary)]" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              No learning paths yet
            </h3>
            <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              Create a structured sequence of courses, assessments, and milestones for your learners
              using the form above.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[var(--admin-border)]">
              {paths.map((path) => {
                const typeCfg =
                  path.pathType === "program" || path.pathType === "roadmap"
                    ? PATH_TYPE_CONFIG[path.pathType]
                    : null;
                const TypeIcon = path.pathType === "program" ? GraduationCap : Map;
                return (
                  <li key={path.id}>
                    <div className="group flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-[var(--admin-surface-low)] md:px-6 md:py-5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {typeCfg ? (
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeCfg.iconClassName}`}
                          >
                            <TypeIcon className="h-5 w-5" aria-hidden="true" />
                          </div>
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                              {path.title}
                            </span>
                            {typeCfg ? (
                              <span className={`${badgeClassName} ${typeCfg.className}`}>
                                <TypeIcon className="h-3 w-3" aria-hidden="true" />
                                {typeCfg.label}
                              </span>
                            ) : null}
                            <span
                              className={`${badgeClassName} ${STATUS_CONFIG[path.status] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
                                aria-hidden="true"
                              />
                              {STATUS_LABELS[path.status] ?? path.status}
                            </span>
                          </div>
                          <p className="inline-flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                            <Calendar className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                            Updated{" "}
                            {new Date(path.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/studio/learning-paths/${path.id}`}
                        className={secondaryButtonClassName}
                      >
                        Open builder
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 md:px-6">
              <span className="text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
                Showing {paths.length} of {paths.length} {paths.length === 1 ? "path" : "paths"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3 pt-1 md:grid-cols-3">
        {INFO_CARDS.map(({ icon: Icon, title: cardTitle, description }) => (
          <div key={cardTitle} className={`${panelClassName} p-4`}>
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))]">
              <Icon className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
            </div>
            <h4 className="text-sm font-bold text-[var(--admin-on-surface)]">{cardTitle}</h4>
            <p className="mt-1 text-xs leading-relaxed text-[var(--admin-on-surface-variant)]">
              {description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
