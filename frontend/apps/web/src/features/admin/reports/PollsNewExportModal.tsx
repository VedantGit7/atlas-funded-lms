"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  columnsForDataset,
  pollsExportsApi,
  isIdentityDataset,
  type CreatePollExportBody,
  type PollExportCadence,
  type PollExportDataset,
  type PollExportDelivery,
  type PollExportFormat,
  type PollExportGrouping,
  type PollExportHistoryItem,
  type PollExportScheduleItem,
  type PollsExportsPayload,
} from "./admin-polls-exports-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchPollsRoster,
  type PollListItem,
} from "./admin-polls-roster-api";
import {
  ExportColumnChecklist,
  ExportDatasetPills,
  ExportDeliverySection,
  ExportDialogFrame,
  ExportDialogNote,
  ExportDialogSection,
  ExportField,
  ExportFiltersSection,
  ExportFormatSection,
  ExportGroupingSection,
  ExportScheduleSection,
  exportCheckboxClassName,
  exportFieldLabelClassName,
  exportInputClassName,
} from "./export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

const DATASET_OPTIONS: Array<{ value: PollExportDataset; label: string }> = [
  { value: "poll_summary", label: "Poll summary" },
  { value: "option_tallies", label: "Option tallies" },
  { value: "respondents", label: "Respondents" },
  { value: "non_respondents", label: "Non-respondents" },
];

const GROUPING_OPTIONS: Array<{ value: PollExportGrouping; label: string }> = [
  { value: "none", label: "None" },
  { value: "poll", label: "By poll" },
  { value: "live_session", label: "By live session" },
  { value: "option", label: "By option" },
];

/** What the roster filters contribute; the polls roster does not pass its filters in. */
const FILTER_SUMMARY = "Roster filters (if any)";

export function PollsNewExportModal({
  open,
  onClose,
  payload,
  schedulePreset,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  payload: PollsExportsPayload;
  schedulePreset?: boolean;
  onCreated: (result: {
    run: PollExportHistoryItem;
    schedule: PollExportScheduleItem | null;
  }) => void;
}) {
  const form = useNewExportForm<PollExportFormat, PollExportDelivery, PollExportCadence>({
    open,
    onClose,
    initialScheduleEnabled: schedulePreset ?? false,
    defaults: {
      format: "csv",
      delivery: "download",
      cadence: "weekly",
      time: "06:00",
      timezone: "Asia/Kolkata",
    },
  });
  const [dataset, setDataset] = useState<PollExportDataset>("poll_summary");
  const [pollQuery, setPollQuery] = useState("");
  const [pollOptions, setPollOptions] = useState<PollListItem[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [selectedPolls, setSelectedPolls] = useState<
    Array<{ id: string; title: string; liveSessionId: string | null }>
  >([]);
  const [allPollsInSession, setAllPollsInSession] = useState(false);
  const [allPollsInRange, setAllPollsInRange] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [grouping, setGrouping] = useState<PollExportGrouping>("none");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);

  const columns = useMemo(() => columnsForDataset(payload, dataset), [payload, dataset]);

  useEffect(() => {
    if (!open) return;
    setDataset("poll_summary");
    setPollQuery("");
    setPollOptions([]);
    setSelectedPolls([]);
    setAllPollsInSession(false);
    setAllPollsInRange(false);
    setLiveSessionId("");
    setRangeFrom("");
    setRangeTo("");
    setSelected(
      new Set(
        columnsForDataset(payload, "poll_summary")
          .filter((column) => column.defaultSelected)
          .map((column) => column.key),
      ),
    );
    setUseCurrentFilters(true);
    setGrouping("none");
    setIncludeSubtotals(false);
  }, [open, payload]);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
  }, [open, dataset, columns]);

  useEffect(() => {
    if (!open || allPollsInSession || allPollsInRange) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPollsLoading(true);
      void (async () => {
        try {
          const response = await fetchPollsRoster({
            ...(pollQuery.trim() ? { q: pollQuery.trim() } : {}),
            page: 1,
            limit: 20,
          });
          if (!cancelled) setPollOptions(response.data.items);
        } catch {
          if (!cancelled) setPollOptions([]);
        } finally {
          if (!cancelled) setPollsLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, pollQuery, allPollsInSession, allPollsInRange]);

  const selectedIds = useMemo(() => new Set(selectedPolls.map((poll) => poll.id)), [selectedPolls]);

  const firstPollSessionId =
    selectedPolls.find((poll) => poll.liveSessionId)?.liveSessionId ?? null;

  if (!open) return null;

  function toggleColumn(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addPoll(poll: PollListItem) {
    setAllPollsInSession(false);
    setAllPollsInRange(false);
    setSelectedPolls((current) =>
      current.some((item) => item.id === poll.id)
        ? current
        : [...current, { id: poll.id, title: poll.title, liveSessionId: poll.liveSessionId }],
    );
    setPollQuery("");
  }

  function removePoll(id: string) {
    setSelectedPolls((current) => current.filter((item) => item.id !== id));
  }

  function scopeSummary(): string {
    if (allPollsInSession) {
      const session = liveSessionId.trim() || firstPollSessionId || "session not set";
      return `All polls in session · ${session}`;
    }
    if (allPollsInRange) {
      const range =
        rangeFrom && rangeTo
          ? `${rangeFrom} - ${rangeTo}`
          : rangeFrom
            ? `From ${rangeFrom}`
            : rangeTo
              ? `Until ${rangeTo}`
              : "date range not set";
      return `All polls in range · ${range}`;
    }
    if (selectedPolls.length === 0) return "No polls selected";
    if (selectedPolls.length === 1) return selectedPolls[0]?.title ?? "1 poll";
    return `${String(selectedPolls.length)} polls`;
  }

  async function onSubmit() {
    if (selected.size === 0) return form.fail("Select at least one column.");
    if (!allPollsInSession && !allPollsInRange && selectedPolls.length === 0) {
      return form.fail("Select at least one poll, or enable a scope shortcut.");
    }
    if (allPollsInSession && !(liveSessionId.trim() || firstPollSessionId)) {
      return form.fail("Enter a live session ID or select a poll linked to a session.");
    }
    if (allPollsInRange && !rangeFrom && !rangeTo) {
      return form.fail("Set at least one date for the range shortcut.");
    }
    if (form.delivery === "recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }
    if (form.scheduleEnabled && !form.scheduleName.trim()) {
      return form.fail("Enter a name for the scheduled export.");
    }

    const body: CreatePollExportBody = {
      dataset,
      columns: [...selected],
      format: form.format,
      useCurrentFilters,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
    };

    if (allPollsInSession) {
      body.allPollsInSession = true;
      const sessionId = liveSessionId.trim() || firstPollSessionId;
      if (sessionId) body.liveSessionId = sessionId;
    } else if (allPollsInRange) {
      body.allPollsInRange = true;
      const fromIso = dateInputToStartIso(rangeFrom);
      const toIso = dateInputToEndIso(rangeTo);
      if (fromIso) body.respondedFrom = fromIso;
      if (toIso) body.respondedTo = toIso;
    } else {
      body.pollIds = selectedPolls.map((poll) => poll.id);
      if (liveSessionId.trim()) body.liveSessionId = liveSessionId.trim();
    }

    if (useCurrentFilters) {
      body.filterSummary = FILTER_SUMMARY;
    }

    if (grouping !== "none") {
      body.grouping = grouping;
      body.includeSubtotals = includeSubtotals;
    } else {
      body.grouping = "none";
    }

    if (form.delivery === "recipients") {
      body.recipients = form.recipients;
    }

    if (form.scheduleEnabled) {
      body.scheduleName = form.scheduleName.trim();
      body.cadence = form.cadence;
      body.time = form.time;
      body.timezone = form.timezone;
    }

    return form.submit(
      () => pollsExportsApi.create(body),
      (run, schedule) => {
        onCreated({ run, schedule });
      },
    );
  }

  return (
    <ExportDialogFrame
      saving={form.saving}
      error={form.error}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
    >
      <ExportDatasetPills
        options={DATASET_OPTIONS.filter((option) =>
          payload.capabilities.datasets.includes(option.value),
        )}
        value={dataset}
        onChange={setDataset}
      />

      <ExportDialogSection title="Scope">
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allPollsInSession}
              onChange={(event) => {
                const next = event.target.checked;
                setAllPollsInSession(next);
                if (next) {
                  setAllPollsInRange(false);
                  setSelectedPolls([]);
                }
              }}
              className={exportCheckboxClassName}
            />
            <span className="text-sm text-[var(--admin-on-surface)]">All polls in session</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allPollsInRange}
              onChange={(event) => {
                const next = event.target.checked;
                setAllPollsInRange(next);
                if (next) {
                  setAllPollsInSession(false);
                  setSelectedPolls([]);
                }
              }}
              className={exportCheckboxClassName}
            />
            <span className="text-sm text-[var(--admin-on-surface)]">All polls in range</span>
          </label>

          {!allPollsInSession && !allPollsInRange ? (
            <div>
              <span className={`mb-2 block ${exportFieldLabelClassName}`}>Polls</span>
              <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 focus-within:border-[var(--admin-primary)]">
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedPolls.map((poll) => (
                    <span
                      key={poll.id}
                      className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                    >
                      {poll.title}
                      <button
                        type="button"
                        aria-label={`Remove ${poll.title}`}
                        className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                        onClick={() => {
                          removePoll(poll.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <input
                    value={pollQuery}
                    onChange={(event) => {
                      setPollQuery(event.target.value);
                    }}
                    aria-label="Search polls"
                    placeholder="Search polls…"
                    className="h-9 w-full rounded-sm border-none bg-transparent pr-3 pl-8 text-sm text-[var(--admin-on-surface)] outline-none"
                  />
                </div>
                {pollsLoading ? (
                  <p className="mt-2 px-2 text-xs text-[var(--admin-on-surface-variant)]">
                    Searching…
                  </p>
                ) : pollOptions.length > 0 ? (
                  <ul className="mt-2 max-h-40 overflow-y-auto border-t border-[var(--admin-border)] pt-2">
                    {pollOptions.map((poll) => (
                      <li key={poll.id}>
                        <button
                          type="button"
                          disabled={selectedIds.has(poll.id)}
                          onClick={() => {
                            addPoll(poll);
                          }}
                          className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                        >
                          <span className="truncate">{poll.title}</span>
                          {poll.liveSessionId ? (
                            <span className="ml-2 shrink-0 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              session
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : pollQuery.trim() ? (
                  <p className="mt-2 px-2 text-xs text-[var(--admin-on-surface-variant)]">
                    No polls found.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {allPollsInRange ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ExportField label="From">
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(event) => {
                    setRangeFrom(event.target.value);
                  }}
                  className={exportInputClassName}
                />
              </ExportField>
              <ExportField label="To">
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(event) => {
                    setRangeTo(event.target.value);
                  }}
                  className={exportInputClassName}
                />
              </ExportField>
            </div>
          ) : null}

          <div className="space-y-2">
            <ExportField
              label={`Live session ID ${allPollsInSession ? "(required)" : "(optional)"}`}
            >
              <div className="flex gap-2">
                <input
                  value={liveSessionId}
                  onChange={(event) => {
                    setLiveSessionId(event.target.value);
                  }}
                  placeholder={
                    allPollsInSession
                      ? "Enter session ID or use from poll"
                      : "Optional, narrows to a session"
                  }
                  className={`min-w-0 flex-1 ${exportInputClassName}`}
                />
                {firstPollSessionId && !liveSessionId.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLiveSessionId(firstPollSessionId);
                    }}
                    className={`${ghostButtonClassName} h-10 shrink-0 px-3 text-xs`}
                  >
                    From poll
                  </button>
                ) : null}
              </div>
            </ExportField>
            {!allPollsInSession ? (
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Leave empty unless exporting all polls in a session. When &quot;All polls in
                session&quot; is enabled, enter a session ID or pick one from a selected poll.
              </p>
            ) : null}
          </div>

          <p className="text-xs text-[var(--admin-on-surface-variant)]">{scopeSummary()}</p>
        </div>
      </ExportDialogSection>

      <ExportColumnChecklist
        columns={columns}
        selected={selected}
        onToggle={toggleColumn}
        onSelectAll={() => {
          setSelected(new Set(columns.map((column) => column.key)));
        }}
        badgeFor={(key) =>
          key === "email"
            ? "pii"
            : columns.find((column) => column.key === key)?.sensitive
              ? "sensitive"
              : null
        }
        warning={selected.has("email") ? "Contains learner personal data" : null}
      />

      {isIdentityDataset(dataset) ? (
        <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
          Anonymous polls contribute option tallies only. No identity columns are produced for them.
        </div>
      ) : null}

      <ExportFiltersSection
        summary={FILTER_SUMMARY}
        useCurrentFilters={useCurrentFilters}
        onUseCurrentFiltersChange={setUseCurrentFilters}
      />

      <ExportGroupingSection
        options={GROUPING_OPTIONS}
        grouping={grouping}
        onGroupingChange={setGrouping}
        includeSubtotals={includeSubtotals}
        onIncludeSubtotalsChange={setIncludeSubtotals}
      />

      <ExportFormatSection
        formats={payload.capabilities.formats}
        value={form.format}
        onChange={form.setFormat}
      />

      <ExportDeliverySection
        form={form}
        emailEnabled={payload.capabilities.canEmailDelivery}
        webhook={false}
      />

      {payload.capabilities.canSchedule ? (
        <ExportScheduleSection form={form} namePlaceholder="Weekly poll summary export" />
      ) : null}

      <ExportDialogNote>{payload.capabilities.note}</ExportDialogNote>
    </ExportDialogFrame>
  );
}
