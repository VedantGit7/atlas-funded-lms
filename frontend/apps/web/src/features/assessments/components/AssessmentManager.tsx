"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { z } from "zod";
import {
  AlertCircle,
  ArrowRight,
  Award,
  ClipboardList,
  Filter,
  Search,
} from "lucide-react";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { assessmentSummarySchema } from "../assessment-response-schemas";
import {
  ASSESSMENT_TYPE_CONFIG,
  DEFAULT_ASSESSMENT_TYPE,
  ASSESSMENT_TYPE_OPTIONS,
  STATUS_CONFIG,
  STATUS_LABELS,
  badgeClassName,
  formatAssessmentDate,
  inputClass,
  labelClass,
  listRowClassName,
  listRowReviewAccentClassName,
  panelClassName,
  secondaryButtonClassName,
  sectionHeaderClassName,
  typeChipButtonClassName,
  typeChipGroupClassName,
} from "../assessment-studio-shared";

type AssessmentSummary = z.infer<typeof assessmentSummarySchema>;

type AssessmentManagerProps = {
  assessments: AssessmentSummary[];
};

export function AssessmentManager({ assessments }: AssessmentManagerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assessmentType, setAssessmentType] =
    useState<(typeof ASSESSMENT_TYPE_OPTIONS)[number]["value"]>("quiz");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assessments;
    return assessments.filter((assessment) => {
      const typeLabel =
        ASSESSMENT_TYPE_CONFIG[assessment.assessmentType]?.label ?? assessment.assessmentType;
      return (
        assessment.title.toLowerCase().includes(needle) ||
        typeLabel.toLowerCase().includes(needle) ||
        assessment.status.toLowerCase().includes(needle)
      );
    });
  }, [assessments, query]);

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;

    setCreating(true);
    setError(null);
    try {
      const response = await clientApi.post<{ data: AssessmentSummary }>(
        "/api/v1/assessments",
        { title: trimmed, assessmentType, config: {} },
        "assessment-create",
      );
      router.push(`/studio/assessments/${response.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Failed to create assessment.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className={panelClassName}>
        <div className="p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            New assessment
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
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="min-w-[240px] flex-1">
              <label className="sr-only" htmlFor="new-assessment-title">
                Assessment title
              </label>
              <input
                id="new-assessment-title"
                value={title}
                disabled={creating}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                className={inputClass}
                placeholder="e.g. Price Action Fundamentals Quiz"
              />
            </div>
            <div className={typeChipGroupClassName} role="group" aria-label="Assessment type">
              {ASSESSMENT_TYPE_OPTIONS.map((option) => {
                const cfg = ASSESSMENT_TYPE_CONFIG[option.value];
                const Icon = cfg?.icon;
                const isSelected = assessmentType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={creating}
                    onClick={() => {
                      setAssessmentType(option.value);
                    }}
                    className={typeChipButtonClassName(isSelected, cfg?.chipSelected ?? "")}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={creating || !title.trim()}
              onClick={() => {
                void handleCreate();
              }}
              className={`${primaryButtonClassName} h-10 shrink-0 px-5`}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </section>

      <section className={`${panelClassName} overflow-hidden`}>
        <div className={sectionHeaderClassName}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            Assessments
            <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-primary)]">
              {filtered.length}
            </span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Toggle search"
              aria-pressed={showSearch}
              onClick={() => {
                setShowSearch((current) => !current);
              }}
              className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Filter assessments"
              className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {showSearch ? (
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
            <label className="sr-only" htmlFor="assessment-search">
              Search assessments
            </label>
            <input
              id="assessment-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              className={inputClass}
              placeholder="Search by title, type, or status..."
            />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
              <ClipboardList className="h-5 w-5 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                {assessments.length === 0 ? "No assessments yet" : "No matching assessments"}
              </p>
              <p className="mt-0.5 max-w-sm text-xs text-[var(--admin-on-surface-variant)]">
                {assessments.length === 0
                  ? "Create your first assessment to compose items from the item bank."
                  : "Try a different search term."}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {filtered.map((assessment) => {
              const typeCfg =
                ASSESSMENT_TYPE_CONFIG[assessment.assessmentType] ?? DEFAULT_ASSESSMENT_TYPE;
              const TypeIcon = typeCfg.icon;
              const isReview = assessment.status === "REVIEW";
              const isReadiness = assessment.assessmentType === "readiness_review";

              return (
                <div
                  key={assessment.id}
                  className={`${listRowClassName}${isReview ? ` ${listRowReviewAccentClassName}` : ""}`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeCfg.iconSurface}`}
                    >
                      <TypeIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                          {assessment.title}
                        </h3>
                        <span className={`${badgeClassName} ${typeCfg.className}`}>
                          {typeCfg.label}
                        </span>
                        <span
                          className={`${badgeClassName} ${STATUS_CONFIG[assessment.status] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
                        >
                          {STATUS_LABELS[assessment.status] ?? assessment.status}
                        </span>
                        {isReadiness ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-[var(--admin-warning)]">
                            <Award className="h-3.5 w-3.5" aria-hidden="true" />
                            Certification level
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                        <span>{String(assessment.config.passMarkPercent)}% pass mark</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--admin-border)]" aria-hidden="true" />
                        <span>{assessment.config.attemptsAllowed} attempts</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--admin-border)]" aria-hidden="true" />
                        <span>Updated {formatAssessmentDate(assessment.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/studio/assessments/${assessment.id}`}
                    className={`${secondaryButtonClassName} h-8 shrink-0 px-3 text-xs`}
                  >
                    Open builder
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
