"use client";

import { CalendarDays } from "lucide-react";
import { Select, type SelectOption } from "@atlas/design-system";
import {
  applyToolbarButtonClassName,
  toolbarLabelClassName,
  toolbarSegmentClassName,
  toolbarSelectTriggerClassName,
} from "../analytics-studio-shared";

type CourseOption = { id: string; title: string };
type AssessmentOption = { id: string; title: string };

type AnalyticsFilterToolbarProps = {
  courses: CourseOption[];
  assessments: AssessmentOption[];
  courseId: string;
  assessmentId: string;
  from: string;
  to: string;
  loading?: boolean;
  onCourseChange: (value: string) => void;
  onAssessmentChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
};

const dateInputClassName =
  "w-[6.75rem] min-w-0 cursor-pointer border-0 bg-transparent py-0 pr-5 text-sm font-medium leading-none tabular-nums text-[var(--admin-on-surface)] shadow-none outline-none ring-0 transition-colors duration-200 ease-out [color-scheme:light] focus:outline-none focus:ring-0 focus:text-[var(--admin-primary)] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

function FilterDate({
  label,
  value,
  ariaLabel,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="group/date inline-flex items-center gap-1.5">
      <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)] transition-colors duration-200 group-focus-within/date:text-[var(--admin-on-surface)]">
        {label}
      </span>
      <span className="relative inline-flex items-center">
        <input
          type="date"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={dateInputClassName}
          aria-label={ariaLabel}
          disabled={disabled}
        />
        <CalendarDays
          className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)] transition-colors duration-200 group-focus-within/date:text-[var(--admin-primary)]"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

export function AnalyticsFilterToolbar({
  courses,
  assessments,
  courseId,
  assessmentId,
  from,
  to,
  loading = false,
  onCourseChange,
  onAssessmentChange,
  onFromChange,
  onToChange,
  onApply,
}: AnalyticsFilterToolbarProps) {
  const courseOptions: SelectOption[] = courses.map((course) => ({
    value: course.id,
    label: course.title,
  }));

  const assessmentOptions: SelectOption[] = [
    { value: "", label: "All evaluations" },
    ...assessments.map((assessment) => ({
      value: assessment.id,
      label: assessment.title,
    })),
  ];

  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm xl:w-auto"
      role="group"
      aria-label="Analytics filters"
    >
      <div className="flex flex-nowrap items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain">
        <div className={toolbarSegmentClassName}>
          <span className={toolbarLabelClassName}>Course</span>
          <Select
            ariaLabel="Filter by course"
            value={courseId}
            onValueChange={onCourseChange}
            options={courseOptions}
            disabled={loading || courseOptions.length === 0}
            className={toolbarSelectTriggerClassName}
          />
        </div>

        <div className={toolbarSegmentClassName}>
          <span className={toolbarLabelClassName}>Assessment</span>
          <Select
            ariaLabel="Filter by assessment"
            value={assessmentId}
            onValueChange={onAssessmentChange}
            options={assessmentOptions}
            disabled={loading}
            placeholder="All evaluations"
            className={toolbarSelectTriggerClassName}
          />
        </div>

        <div className="group/dates flex h-10 shrink-0 items-center gap-3 px-3 transition-[background-color] duration-200 ease-out hover:bg-[var(--admin-surface-low)] focus-within:bg-[color-mix(in_srgb,var(--admin-primary)_7%,var(--admin-surface-low))]">
          <FilterDate
            label="From"
            value={from}
            ariaLabel="Analytics from date"
            disabled={loading}
            onChange={onFromChange}
          />
          <FilterDate
            label="To"
            value={to}
            ariaLabel="Analytics to date"
            disabled={loading}
            onChange={onToChange}
          />
          <button
            type="button"
            className={`${applyToolbarButtonClassName} transition-[opacity,transform,background-color] duration-200 ease-out`}
            disabled={loading}
            onClick={onApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
