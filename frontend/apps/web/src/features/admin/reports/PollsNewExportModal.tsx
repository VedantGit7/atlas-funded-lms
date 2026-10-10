"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Download, Info, Loader2, Search, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
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
import { PolicyToggle } from "./report-exports-kit";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchPollsRoster,
  type PollListItem,
} from "./admin-polls-roster-api";

const selectTriggerClassName =
  "h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

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
  const titleId = useId();
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
  const [format, setFormat] = useState<PollExportFormat>("csv");
  const [delivery, setDelivery] = useState<PollExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [cadence, setCadence] = useState<PollExportCadence>("weekly");
  const [time, setTime] = useState("06:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => columnsForDataset(payload, dataset), [payload, dataset]);

  const showAnonymityNotice = isIdentityDataset(dataset);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

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
    setFormat("csv");
    setDelivery("download");
    setRecipientInput("");
    setRecipients([]);
    setScheduleEnabled(schedulePreset ?? false);
    setScheduleName("");
    setCadence("weekly");
    setTime("06:00");
    setTimezone("Asia/Kolkata");
    setError(null);
  }, [open, payload, schedulePreset]);

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

  const hasEmailSelected = selected.has("email");

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
        : [
            ...current,
            {
              id: poll.id,
              title: poll.title,
              liveSessionId: poll.liveSessionId,
            },
          ],
    );
    setPollQuery("");
  }

  function removePoll(id: string) {
    setSelectedPolls((current) => current.filter((item) => item.id !== id));
  }

  function addRecipient() {
    const email = recipientInput.trim();
    if (!email || !email.includes("@")) return;
    setRecipients((current) => (current.includes(email) ? current : [...current, email]));
    setRecipientInput("");
  }

  function scopeSummary(): string {
    if (allPollsInSession) {
      const session = liveSessionId.trim() || firstPollSessionId || "session not set";
      return `All polls in session · ${session}`;
    }
    if (allPollsInRange) {
      const range =
        rangeFrom && rangeTo
          ? `${rangeFrom} – ${rangeTo}`
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
    if (selected.size === 0) {
      setError("Select at least one column.");
      return;
    }
    if (!allPollsInSession && !allPollsInRange && selectedPolls.length === 0) {
      setError("Select at least one poll, or enable a scope shortcut.");
      return;
    }
    if (allPollsInSession) {
      const sessionId = liveSessionId.trim() || firstPollSessionId;
      if (!sessionId) {
        setError("Enter a live session ID or select a poll linked to a session.");
        return;
      }
    }
    if (allPollsInRange && !rangeFrom && !rangeTo) {
      setError("Set at least one date for the range shortcut.");
      return;
    }
    if (delivery === "recipients" && recipients.length === 0) {
      setError("Add at least one recipient email.");
      return;
    }
    if (scheduleEnabled && !scheduleName.trim()) {
      setError("Enter a name for the scheduled export.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: CreatePollExportBody = {
        dataset,
        columns: [...selected],
        format,
        useCurrentFilters,
        delivery,
        scheduleEnabled,
      };

      if (allPollsInSession) {
        body.allPollsInSession = true;
        const sessionId = liveSessionId.trim() || firstPollSessionId;
        if (sessionId) {
          body.liveSessionId = sessionId;
        }
      } else if (allPollsInRange) {
        body.allPollsInRange = true;
        const fromIso = dateInputToStartIso(rangeFrom);
        const toIso = dateInputToEndIso(rangeTo);
        if (fromIso) body.respondedFrom = fromIso;
        if (toIso) body.respondedTo = toIso;
      } else {
        body.pollIds = selectedPolls.map((poll) => poll.id);
        if (liveSessionId.trim()) {
          body.liveSessionId = liveSessionId.trim();
        }
      }

      if (useCurrentFilters) {
        body.filterSummary = "Roster filters (if any)";
      }

      if (grouping !== "none") {
        body.grouping = grouping;
        body.includeSubtotals = includeSubtotals;
      } else {
        body.grouping = "none";
      }

      if (delivery === "recipients") {
        body.recipients = recipients;
      }

      if (scheduleEnabled) {
        body.scheduleName = scheduleName.trim();
        body.cadence = cadence;
        body.time = time;
        body.timezone = timezone;
      }

      const response = await pollsExportsApi.create(body);
      onCreated(response.data);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id={titleId}
            className="text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
          >
            New export
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Dataset</h3>
            <div className="flex flex-wrap gap-2">
              {DATASET_OPTIONS.filter((option) =>
                payload.capabilities.datasets.includes(option.value),
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setDataset(option.value);
                  }}
                  className={`rounded-sm border px-3 py-2 text-sm font-medium transition-colors ${
                    dataset === option.value
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Scope</h3>
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
                  className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
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
                  className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
                <span className="text-sm text-[var(--admin-on-surface)]">All polls in range</span>
              </label>

              {!allPollsInSession && !allPollsInRange ? (
                <div>
                  <span className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Polls
                  </span>
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
                        {pollOptions.map((poll) => {
                          const already = selectedIds.has(poll.id);
                          return (
                            <li key={poll.id}>
                              <button
                                type="button"
                                disabled={already}
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
                          );
                        })}
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
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      From
                    </span>
                    <input
                      type="date"
                      value={rangeFrom}
                      onChange={(event) => {
                        setRangeFrom(event.target.value);
                      }}
                      className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      To
                    </span>
                    <input
                      type="date"
                      value={rangeTo}
                      onChange={(event) => {
                        setRangeTo(event.target.value);
                      }}
                      className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </label>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Live session ID
                    {allPollsInSession ? " (required)" : " (optional)"}
                  </span>
                  <div className="flex gap-2">
                    <input
                      value={liveSessionId}
                      onChange={(event) => {
                        setLiveSessionId(event.target.value);
                      }}
                      placeholder={
                        allPollsInSession
                          ? "Enter session ID or use from poll"
                          : "Optional — narrows to a session"
                      }
                      className="h-10 min-w-0 flex-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
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
                </label>
                {!allPollsInSession ? (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Leave empty unless exporting all polls in a session. When &quot;All polls in
                    session&quot; is enabled, enter a session ID or pick one from a selected poll.
                  </p>
                ) : null}
              </div>

              <p className="text-xs text-[var(--admin-on-surface-variant)]">{scopeSummary()}</p>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Columns</h3>
              <button
                type="button"
                className="text-sm text-[var(--admin-primary)] hover:underline"
                onClick={() => {
                  setSelected(new Set(columns.map((column) => column.key)));
                }}
              >
                Select all
              </button>
            </div>
            {hasEmailSelected ? (
              <div className="mb-3 flex items-start gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-warning)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Contains learner personal data</span>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column.key}
                  className="group flex cursor-pointer items-start justify-between gap-3"
                  title={column.key === "email" ? "Contains learner personal data" : undefined}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(column.key)}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                      className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                      {column.label}
                    </span>
                  </span>
                  {column.key === "email" ? (
                    <span
                      title="Contains learner personal data"
                      className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-warning)] uppercase"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      PII
                    </span>
                  ) : column.sensitive ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-danger)] uppercase">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Sensitive
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </section>

          {showAnonymityNotice ? (
            <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
              Anonymous polls contribute option tallies only. No identity columns are produced for
              them.
            </div>
          ) : null}

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Filters</h3>
            <div className="flex flex-col gap-4 rounded-sm border border-[var(--admin-border)] p-4 sm:flex-row sm:items-start sm:justify-between">
              <label className="min-w-0 flex-1">
                <span className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Filter summary
                </span>
                <textarea
                  readOnly
                  value="Roster filters (if any)"
                  rows={2}
                  className="w-full resize-none rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)] outline-none"
                />
              </label>
              <label className="flex shrink-0 items-center gap-3 pt-6 sm:pt-8">
                <span className="text-sm text-[var(--admin-on-surface)]">Use current filters</span>
                <PolicyToggle
                  checked={useCurrentFilters}
                  onChange={setUseCurrentFilters}
                  label="Use current filters"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Grouping
            </h3>
            <div className="space-y-3 rounded-sm border border-[var(--admin-border)] p-4">
              <label className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Group by
                </span>
                <Select
                  value={grouping}
                  onValueChange={(value) => {
                    const next = value as PollExportGrouping;
                    setGrouping(next);
                    if (next === "none") setIncludeSubtotals(false);
                  }}
                  options={GROUPING_OPTIONS}
                  className={selectTriggerClassName}
                />
              </label>
              <label
                className={`flex items-center gap-3 ${grouping === "none" ? "opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={includeSubtotals}
                  disabled={grouping === "none"}
                  onChange={(event) => {
                    setIncludeSubtotals(event.target.checked);
                  }}
                  className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] disabled:cursor-not-allowed"
                />
                <span className="text-sm text-[var(--admin-on-surface)]">
                  Include per-group subtotals
                </span>
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Format</h3>
            <div className="inline-flex rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
              {payload.capabilities.formats.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFormat(value);
                  }}
                  className={`rounded-sm px-5 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase transition-all ${
                    format === value
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Delivery
            </h3>
            <div className="space-y-3">
              {(
                [
                  ["download", "Download now"],
                  ["email_me", "Email me when ready"],
                  ["recipients", "Send to recipients"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="polls-export-delivery"
                    checked={delivery === value}
                    onChange={() => {
                      setDelivery(value);
                    }}
                    disabled={value !== "download" && !payload.capabilities.canEmailDelivery}
                    className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] disabled:opacity-50"
                  />
                  <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
                </label>
              ))}
              {delivery === "recipients" ? (
                <div className="space-y-4 pt-2 pl-7">
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Recipients
                    </label>
                    <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 focus-within:border-[var(--admin-primary)]">
                      {recipients.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                        >
                          {email}
                          <button
                            type="button"
                            className="ml-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                            onClick={() => {
                              setRecipients((current) => current.filter((item) => item !== email));
                            }}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                      <input
                        value={recipientInput}
                        onChange={(event) => {
                          setRecipientInput(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addRecipient();
                          }
                        }}
                        onBlur={addRecipient}
                        placeholder="Add email…"
                        className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm text-[var(--admin-on-surface)] outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {payload.capabilities.canSchedule ? (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Schedule</h3>
                <label className="flex items-center gap-3">
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">
                    Schedule this export
                  </span>
                  <PolicyToggle
                    checked={scheduleEnabled}
                    onChange={setScheduleEnabled}
                    label="Schedule this export"
                  />
                </label>
              </div>
              {scheduleEnabled ? (
                <div className="space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Name
                    </span>
                    <input
                      value={scheduleName}
                      onChange={(event) => {
                        setScheduleName(event.target.value);
                      }}
                      placeholder="Weekly poll summary export"
                      className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Cadence
                      </span>
                      <Select
                        value={cadence}
                        onValueChange={(value) => {
                          setCadence(value as PollExportCadence);
                        }}
                        options={[
                          { value: "daily", label: "Daily" },
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                        ]}
                        className={selectTriggerClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Time
                      </span>
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => {
                          setTime(event.target.value);
                        }}
                        className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Timezone
                      </span>
                      <Select
                        value={timezone}
                        onValueChange={setTimezone}
                        options={[
                          { value: "UTC", label: "UTC" },
                          { value: "Asia/Kolkata", label: "Asia/Kolkata" },
                          { value: "America/New_York", label: "America/New_York" },
                          { value: "America/Los_Angeles", label: "America/Los_Angeles" },
                          { value: "Europe/London", label: "Europe/London" },
                        ]}
                        className={selectTriggerClassName}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="flex items-start gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <span>{payload.capabilities.note}</span>
          </div>

          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Create export
          </button>
        </footer>
      </div>
    </div>
  );
}
