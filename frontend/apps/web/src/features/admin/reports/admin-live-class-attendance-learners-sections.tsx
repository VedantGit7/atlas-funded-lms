"use client";

import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  Columns3,
  Download,
  Mail,
  MoreVertical,
  Search,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
  memberInitials,
} from "../../studio/courses/admin-form-dropdown-shared";
import { LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS } from "./admin-live-class-attendance-roster-api";
import {
  ATTENDANCE_RATE_OPTIONS,
  LAST_ATTENDED_OPTIONS,
  MetricBar,
  SESSIONS_REGISTERED_OPTIONS,
  SORT_OPTIONS,
  SortHeader,
  StreakPill,
  exportLearnersCsv,
  fieldClassName,
  formatDuration,
  formatPct,
  healthRailClass,
  secondaryButtonClassName,
} from "./admin-live-class-attendance-learners-shared";
import type { LiveClassAttendanceLearnersView } from "./use-live-class-attendance-learners";

/** The heading, date range, export and saved views. */
export function LearnersToolbar({ view }: { view: LiveClassAttendanceLearnersView }) {
  const {
    applyDatePreset,
    closeFilterMenus,
    columns,
    columnsLabelId,
    columnsOpen,
    dateMenuOpen,
    datePreset,
    datePresetLabel,
    datePresetLabelId,
    learners,
    loading,
    openLowAttendanceMessage,
    setAttendanceRateOpen,
    setColumnsOpen,
    setDateMenuOpen,
    setLastAttendedOpen,
    setSessionsRegisteredOpen,
    setSortOpen,
    toggleColumn,
  } = view;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
          Learners
        </h1>
        <p className="mt-1 max-w-[65ch] text-sm text-[var(--admin-on-surface-variant)]">
          Attendance across every live session a learner was registered for.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px]">
          <DropdownField
            label={<span className="sr-only">Date range</span>}
            labelId={datePresetLabelId}
            open={dateMenuOpen}
            onToggle={() => {
              setDateMenuOpen((open) => !open);
              closeFilterMenus();
            }}
            triggerContent={
              <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                <Calendar
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">{datePresetLabel}</span>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${dateMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            }
            panelAriaLabel="Date range presets"
          >
            <div className="p-1.5" role="listbox">
              {(
                [
                  ["7d", "Last 7 days"],
                  ["30d", "Last 30 days"],
                  ["90d", "Last 90 days"],
                  ["custom", "Custom"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={datePreset === value}
                  className={dropdownItemClassName}
                  onClick={() => {
                    applyDatePreset(value);
                    setDateMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>

        <div className="min-w-[140px]">
          <DropdownField
            label={<span className="sr-only">Columns</span>}
            labelId={columnsLabelId}
            open={columnsOpen}
            onToggle={() => {
              setColumnsOpen((open) => !open);
              setDateMenuOpen(false);
              setAttendanceRateOpen(false);
              setSessionsRegisteredOpen(false);
              setLastAttendedOpen(false);
              setSortOpen(false);
            }}
            triggerContent={
              <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                <Columns3
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">Columns</span>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${columnsOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            }
            panelAriaLabel="Visible columns"
          >
            <div className="space-y-1 p-2" role="group" aria-label="Column checkboxes">
              {LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS.map((column) => {
                const checked = columns.includes(column.key);
                return (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                      checked={checked}
                      disabled={checked && columns.length === 1}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                    />
                    {column.label}
                  </label>
                );
              })}
            </div>
          </DropdownField>
        </div>

        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={loading || learners.length === 0}
          onClick={() => {
            exportLearnersCsv(learners, columns);
          }}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>

        <button type="button" className={primaryButtonClassName} onClick={openLowAttendanceMessage}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Message low-attendance learners
        </button>
      </div>
    </div>
  );
}

/** Attendance totals and the at-risk counts above the list. */
export function LearnersSummary({ view }: { view: LiveClassAttendanceLearnersView }) {
  const { formatCount, setAttendanceRateBand, setPage, summary } = view;
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-8">
      <div className="relative col-span-12 flex flex-col justify-between overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-4">
        <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Learners registered
          </h3>
          <div className="font-mono text-3xl font-semibold text-[var(--admin-on-surface)]">
            {formatCount(summary.learnersRegistered)}
          </div>
        </div>
        <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">
          for at least one session in range
        </p>
      </div>

      <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2">
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Average attendance rate
          </h3>
          <div className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
            {formatPct(summary.avgAttendanceRatePct)}
          </div>
        </div>
        <div className="mt-3">
          <MetricBar pct={summary.avgAttendanceRatePct} />
        </div>
      </div>

      <button
        type="button"
        className="col-span-12 flex flex-col justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))] p-5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] active:translate-y-px sm:col-span-6 md:col-span-2"
        onClick={() => {
          setAttendanceRateBand("never_attended");
          setPage(1);
        }}
      >
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-danger)]">
            Never attended
          </h3>
          <div className="font-mono text-2xl font-semibold text-[var(--admin-danger)]">
            {formatCount(summary.neverAttendedCount)}
          </div>
        </div>
        <p className="mt-auto text-xs leading-tight text-[var(--admin-danger)]">
          registered but never joined
        </p>
      </button>

      <button
        type="button"
        className="col-span-12 flex flex-col justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_5%,var(--admin-surface))] p-5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] active:translate-y-px sm:col-span-6 md:col-span-2"
        onClick={() => {
          setAttendanceRateBand("perfect");
          setPage(1);
        }}
      >
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-success)]">
            Perfect attendance
          </h3>
          <div className="font-mono text-2xl font-semibold text-[var(--admin-success)]">
            {formatCount(summary.perfectAttendanceCount)}
          </div>
        </div>
      </button>

      <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2">
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Average coverage
          </h3>
          <div className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
            {formatPct(summary.avgCoveragePct)}
          </div>
        </div>
        <div className="mt-3">
          <MetricBar pct={summary.avgCoveragePct} tone="success" />
        </div>
      </div>
    </div>
  );
}

/** Search, batch, course, attendance band and session filters. */
export function LearnersFilters({ view }: { view: LiveClassAttendanceLearnersView }) {
  const {
    attendanceRateBand,
    attendanceRateLabel,
    attendanceRateLabelId,
    attendanceRateOpen,
    lastAttended,
    lastAttendedLabel,
    lastAttendedLabelId,
    lastAttendedOpen,
    loadLearners,
    page,
    searchQ,
    sessionsRegisteredBand,
    sessionsRegisteredLabel,
    sessionsRegisteredLabelId,
    sessionsRegisteredOpen,
    setAttendanceRateBand,
    setAttendanceRateOpen,
    setColumnsOpen,
    setLastAttended,
    setLastAttendedOpen,
    setPage,
    setSearchQ,
    setSessionsRegisteredBand,
    setSessionsRegisteredOpen,
    setSortBy,
    setSortDir,
    setSortOpen,
    sortBy,
    sortDir,
    sortLabel,
    sortLabelId,
    sortOpen,
  } = view;
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
      <label className="grid min-w-[200px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
        Search
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            className={`${fieldClassName} w-full pl-9`}
            value={searchQ}
            onChange={(event) => {
              setSearchQ(event.target.value);
            }}
            placeholder="Search learner name or email"
          />
        </div>
      </label>

      <div className="min-w-[160px]">
        <DropdownField
          label="Attendance rate"
          labelId={attendanceRateLabelId}
          open={attendanceRateOpen}
          onToggle={() => {
            setAttendanceRateOpen((open) => !open);
            setColumnsOpen(false);
            setSessionsRegisteredOpen(false);
            setLastAttendedOpen(false);
            setSortOpen(false);
          }}
          triggerContent={
            <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
              <span className="flex-1 truncate text-left">{attendanceRateLabel}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${attendanceRateOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
          }
          panelAriaLabel="Attendance rate filter"
        >
          <div className="p-1.5" role="listbox">
            {ATTENDANCE_RATE_OPTIONS.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                role="option"
                aria-selected={attendanceRateBand === option.value}
                className={dropdownItemClassName}
                onClick={() => {
                  setAttendanceRateBand(option.value);
                  setAttendanceRateOpen(false);
                  setPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </DropdownField>
      </div>

      <div className="min-w-[160px]">
        <DropdownField
          label="Sessions registered"
          labelId={sessionsRegisteredLabelId}
          open={sessionsRegisteredOpen}
          onToggle={() => {
            setSessionsRegisteredOpen((open) => !open);
            setColumnsOpen(false);
            setAttendanceRateOpen(false);
            setLastAttendedOpen(false);
            setSortOpen(false);
          }}
          triggerContent={
            <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
              <span className="flex-1 truncate text-left">{sessionsRegisteredLabel}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${sessionsRegisteredOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
          }
          panelAriaLabel="Sessions registered filter"
        >
          <div className="p-1.5" role="listbox">
            {SESSIONS_REGISTERED_OPTIONS.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                role="option"
                aria-selected={sessionsRegisteredBand === option.value}
                className={dropdownItemClassName}
                onClick={() => {
                  setSessionsRegisteredBand(option.value);
                  setSessionsRegisteredOpen(false);
                  setPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </DropdownField>
      </div>

      <div className="min-w-[160px]">
        <DropdownField
          label="Last attended"
          labelId={lastAttendedLabelId}
          open={lastAttendedOpen}
          onToggle={() => {
            setLastAttendedOpen((open) => !open);
            setColumnsOpen(false);
            setAttendanceRateOpen(false);
            setSessionsRegisteredOpen(false);
            setSortOpen(false);
          }}
          triggerContent={
            <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
              <span className="flex-1 truncate text-left">{lastAttendedLabel}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${lastAttendedOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
          }
          panelAriaLabel="Last attended filter"
        >
          <div className="p-1.5" role="listbox">
            {LAST_ATTENDED_OPTIONS.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                role="option"
                aria-selected={lastAttended === option.value}
                className={dropdownItemClassName}
                onClick={() => {
                  setLastAttended(option.value);
                  setLastAttendedOpen(false);
                  setPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </DropdownField>
      </div>

      <div className="min-w-[200px]">
        <DropdownField
          label="Sort"
          labelId={sortLabelId}
          open={sortOpen}
          onToggle={() => {
            setSortOpen((open) => !open);
            setColumnsOpen(false);
            setAttendanceRateOpen(false);
            setSessionsRegisteredOpen(false);
            setLastAttendedOpen(false);
          }}
          triggerContent={
            <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
              <span className="flex-1 truncate text-left">{sortLabel}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
          }
          panelAriaLabel="Sort learners"
        >
          <div className="p-1.5" role="listbox">
            {SORT_OPTIONS.map((option) => (
              <button
                key={`${option.sortBy}-${option.sortDir}`}
                type="button"
                role="option"
                aria-selected={sortBy === option.sortBy && sortDir === option.sortDir}
                className={dropdownItemClassName}
                onClick={() => {
                  setSortBy(option.sortBy);
                  setSortDir(option.sortDir);
                  setSortOpen(false);
                  setPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </DropdownField>
      </div>

      <button
        type="button"
        className={primaryButtonClassName}
        onClick={() => {
          if (page !== 1) setPage(1);
          else void loadLearners();
        }}
      >
        Search
      </button>
    </div>
  );
}

/** The learner attendance table and its row menus. */
export function LearnersTable({ view }: { view: LiveClassAttendanceLearnersView }) {
  const {
    columnVisible,
    formatCount,
    formatDate,
    handleSortHeader,
    learners,
    menuLearnerId,
    openLearner,
    openSelectedMessage,
    selectedIds,
    setMenuLearnerId,
    sortBy,
    sortDir,
    toggleSelectAllVisible,
    toggleSelected,
  } = view;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          <tr>
            <th className="w-11 px-4 py-3">
              <input
                type="checkbox"
                aria-label="Select all visible learners"
                checked={
                  learners.length > 0 &&
                  learners.every((learner) => selectedIds.has(learner.membershipId))
                }
                onChange={toggleSelectAllVisible}
              />
            </th>
            {columnVisible("learner_name") ? <th className="px-4 py-3">Learner</th> : null}
            {columnVisible("batch") ? <th className="px-4 py-3">Batch</th> : null}
            {columnVisible("registered_count") ? <th className="px-4 py-3">Registered</th> : null}
            {columnVisible("attendance_rate") || columnVisible("attended_count") ? (
              <th className="px-4 py-3">
                <SortHeader
                  label="Attended rate"
                  active={sortBy === "attendance_rate" || sortBy === "sessions_attended"}
                  dir={sortDir}
                  onClick={() => {
                    handleSortHeader(
                      sortBy === "sessions_attended" ? "sessions_attended" : "attendance_rate",
                    );
                  }}
                />
              </th>
            ) : null}
            {columnVisible("absent_count") ? <th className="px-4 py-3">Absent</th> : null}
            {columnVisible("total_time") ? (
              <th className="px-4 py-3">
                <SortHeader
                  label="Total time"
                  active={sortBy === "total_time"}
                  dir={sortDir}
                  onClick={() => {
                    handleSortHeader("total_time");
                  }}
                />
              </th>
            ) : null}
            {columnVisible("avg_coverage") ? <th className="px-4 py-3">Avg coverage</th> : null}
            {columnVisible("last_attended") ? (
              <th className="px-4 py-3">
                <SortHeader
                  label="Last attended"
                  active={sortBy === "last_attended"}
                  dir={sortDir}
                  onClick={() => {
                    handleSortHeader("last_attended");
                  }}
                />
              </th>
            ) : null}
            {columnVisible("streak") ? <th className="px-4 py-3">Streak</th> : null}
            <th className="w-11 px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {learners.map((learner) => {
            const selected = selectedIds.has(learner.membershipId);
            return (
              <tr
                key={learner.membershipId}
                className={[
                  "h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors",
                  healthRailClass(learner.health),
                  selected
                    ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                    : "hover:bg-[var(--admin-surface-high)]",
                ].join(" ")}
                onClick={() => {
                  openLearner(learner);
                }}
              >
                <td
                  className="px-4 py-3"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${learner.learnerName ?? learner.email ?? "learner"}`}
                    checked={selected}
                    onChange={() => {
                      toggleSelected(learner.membershipId);
                    }}
                  />
                </td>
                {columnVisible("learner_name") ? (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                        {memberInitials(learner.learnerName, learner.email)}
                      </span>
                      <div>
                        <Link
                          href={`/admin/reports/live-class-attendance/learners/${learner.membershipId}`}
                          className="font-medium text-[var(--admin-primary)] hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          {learner.learnerName ?? "Unknown learner"}
                        </Link>
                        {columnVisible("email") ? (
                          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {learner.email ?? "-"}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                ) : null}
                {columnVisible("batch") ? (
                  <td className="px-4 py-3">
                    <span className="rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                      {learner.batchName ?? "No batch"}
                    </span>
                  </td>
                ) : null}
                {columnVisible("registered_count") ? (
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {formatCount(learner.registeredCount)}
                  </td>
                ) : null}
                {columnVisible("attendance_rate") || columnVisible("attended_count") ? (
                  <td className="px-4 py-3">
                    <div className="min-w-[120px]">
                      <div
                        className={[
                          "font-mono text-[13px]",
                          learner.attendanceRatePct != null && learner.attendanceRatePct < 40
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface)]",
                        ].join(" ")}
                      >
                        {formatCount(learner.attendedCount)} of{" "}
                        {formatCount(learner.registeredCount)}
                        <span className="ml-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                          {formatPct(learner.attendanceRatePct)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <MetricBar
                          pct={learner.attendanceRatePct}
                          tone={
                            learner.attendanceRatePct != null && learner.attendanceRatePct < 40
                              ? "warning"
                              : "primary"
                          }
                        />
                      </div>
                    </div>
                  </td>
                ) : null}
                {columnVisible("absent_count") ? (
                  <td
                    className={[
                      "px-4 py-3 font-mono text-[13px]",
                      learner.absentCount > 0
                        ? "text-[var(--admin-danger)]"
                        : "text-[var(--admin-on-surface)]",
                    ].join(" ")}
                  >
                    {formatCount(learner.absentCount)}
                  </td>
                ) : null}
                {columnVisible("total_time") ? (
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {formatDuration(learner.totalTimeSeconds)}
                  </td>
                ) : null}
                {columnVisible("avg_coverage") ? (
                  <td className="px-4 py-3">
                    <div className="min-w-[88px]">
                      <div
                        className={[
                          "font-mono text-[13px]",
                          learner.avgCoveragePct != null && learner.avgCoveragePct < 40
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface)]",
                        ].join(" ")}
                      >
                        {formatPct(learner.avgCoveragePct)}
                      </div>
                      <div className="mt-1.5">
                        <MetricBar
                          pct={learner.avgCoveragePct}
                          tone={
                            learner.avgCoveragePct != null && learner.avgCoveragePct < 40
                              ? "warning"
                              : "success"
                          }
                        />
                      </div>
                    </div>
                  </td>
                ) : null}
                {columnVisible("last_attended") ? (
                  <td className="px-4 py-3">
                    {learner.lastAttendedSessionId && learner.lastAttendedSessionTitle ? (
                      <div>
                        <Link
                          href={`/admin/reports/live-class-attendance/${learner.lastAttendedSessionId}`}
                          className="font-medium text-[var(--admin-primary)] hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          {learner.lastAttendedSessionTitle}
                        </Link>
                        <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {formatDate(learner.lastAttendedAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-[var(--admin-danger)]">
                        Never attended
                      </span>
                    )}
                  </td>
                ) : null}
                {columnVisible("streak") ? (
                  <td className="px-4 py-3">
                    <StreakPill learner={learner} />
                  </td>
                ) : null}
                <td
                  className="relative px-4 py-3"
                  data-learner-menu
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    className="rounded-full p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                    aria-label={`Actions for ${learner.learnerName ?? "learner"}`}
                    onClick={() => {
                      setMenuLearnerId((current) =>
                        current === learner.membershipId ? null : learner.membershipId,
                      );
                    }}
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {menuLearnerId === learner.membershipId ? (
                    <div className="absolute right-4 top-full z-30 min-w-[180px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                      <button
                        type="button"
                        className={dropdownItemClassName}
                        onClick={() => {
                          openLearner(learner);
                          setMenuLearnerId(null);
                        }}
                      >
                        View attendance
                      </button>
                      <Link
                        href={`/admin/members/${learner.membershipId}`}
                        className={dropdownItemClassName}
                        onClick={() => {
                          setMenuLearnerId(null);
                        }}
                      >
                        Open member profile
                      </Link>
                      <button
                        type="button"
                        className={dropdownItemClassName}
                        onClick={() => {
                          openSelectedMessage([learner.membershipId]);
                          setMenuLearnerId(null);
                        }}
                      >
                        Message learner
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
