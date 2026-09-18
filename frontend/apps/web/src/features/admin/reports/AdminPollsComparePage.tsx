"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bookmark,
  ChevronRight,
  Download,
  GitCompareArrows,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchPollsCompare,
  fetchPollsRoster,
  type PollCompareAlignBy,
  type PollCompareItem,
  type PollCompareOptionRow,
  type PollListItem,
  type PollsCompareData,
} from "./admin-polls-roster-api";
import { csvEscape } from "@/lib/export/csv";

const MAX_SLOTS = 4;
const SAVE_KEY = "atlas.admin.polls.compare.saved";
const SWATCH_OPACITIES = [1, 0.72, 0.48, 0.28] as const;

const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

type ShowField = "shares" | "counts";

type MetricKey =
  | "responseCount"
  | "eligibleCount"
  | "participationPct"
  | "medianResponseSeconds"
  | "correctPct"
  | "earlySharePct"
  | "nonRespondentCount";

type MetricDef = {
  key: MetricKey;
  label: string;
  format: "int" | "pct" | "seconds";
  higherIsBetter: boolean;
};

const METRICS: MetricDef[] = [
  { key: "responseCount", label: "Responses", format: "int", higherIsBetter: true },
  { key: "eligibleCount", label: "Eligible audience", format: "int", higherIsBetter: true },
  { key: "participationPct", label: "Participation", format: "pct", higherIsBetter: true },
  {
    key: "medianResponseSeconds",
    label: "Median time to answer",
    format: "seconds",
    higherIsBetter: false,
  },
  { key: "correctPct", label: "Correct rate", format: "pct", higherIsBetter: true },
  {
    key: "earlySharePct",
    label: "Answered in the first 20 seconds",
    format: "pct",
    higherIsBetter: true,
  },
  {
    key: "nonRespondentCount",
    label: "Non-respondents",
    format: "int",
    higherIsBetter: false,
  },
];

function parseIdsParam(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_SLOTS) break;
  }
  return ids;
}

function metricValue(poll: PollCompareItem, key: MetricKey): number | null {
  const value = poll[key];
  return typeof value === "number" ? value : null;
}

function formatMetric(value: number | null, format: MetricDef["format"]): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (format === "pct") return `${Math.round(value * 10) / 10}%`;
  if (format === "seconds") return `${Math.round(value * 10) / 10}s`;
  return Math.round(value).toLocaleString();
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function deltaTone(delta: number | null, higherIsBetter: boolean): "up" | "down" | "neutral" {
  if (delta == null || Math.abs(delta) < 0.05) return "neutral";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "up" : "down";
}

function formatDelta(delta: number | null, format: MetricDef["format"] | "pts"): string | null {
  if (delta == null || Math.abs(delta) < 0.05) return null;
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  if (format === "pct" || format === "pts") {
    return `${sign}${Math.round(abs * 10) / 10} pts`;
  }
  if (format === "seconds") return `${sign}${Math.round(abs * 10) / 10}s`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

function downloadCsv(data: PollsCompareData) {
  const headers = ["Metric", ...data.polls.map((poll) => poll.shortName)];
  const lines = [headers.map(csvEscape).join(",")];
  for (const metric of METRICS) {
    lines.push(
      [
        metric.label,
        ...data.polls.map((poll) => formatMetric(metricValue(poll, metric.key), metric.format)),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  if (data.optionsAligned) {
    lines.push("");
    lines.push(["Option", ...data.polls.map((poll) => poll.shortName)].map(csvEscape).join(","));
    for (const row of data.optionRows) {
      lines.push(
        [row.label, ...row.cells.map((cell) => (cell.percent == null ? "—" : `${cell.percent}%`))]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `poll-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function groupPickerOptions(items: PollListItem[], selectedIds: string[]) {
  const available = items.filter((item) => !selectedIds.includes(item.id));
  const groups = new Map<string, PollListItem[]>();
  for (const item of available) {
    const key = item.title.trim().toLowerCase() || "untitled";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([key, polls]) => ({
      key,
      label: polls[0]?.title ?? key,
      polls,
    }));
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
      aria-hidden="true"
    />
  );
}

function CompareSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading comparison">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Shimmer className="h-8 w-64" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-11 w-28" />
          <Shimmer className="h-11 w-36" />
        </div>
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-64 w-full" />
        </div>
        <div className="space-y-4 xl:col-span-5">
          <Shimmer className="h-5 w-36" />
          <Shimmer className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

function TrendStrip({
  polls,
  optionRows,
  insight,
}: {
  polls: PollCompareItem[];
  optionRows: PollCompareOptionRow[];
  insight: string | null;
}) {
  const chronological = useMemo(
    () =>
      [...polls].sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()),
    [polls],
  );

  const series = useMemo(() => {
    return optionRows.slice(0, 5).map((row, rowIndex) => {
      const points = chronological.map((poll, index) => {
        const cell = row.cells.find((entry) => entry.pollId === poll.id);
        const x = chronological.length === 1 ? 0 : (index / (chronological.length - 1)) * 100;
        const y = 40 - Math.min(38, Math.max(2, ((cell?.percent ?? 0) / 100) * 36));
        return `${x},${y}`;
      });
      return {
        key: row.key,
        label: row.label,
        opacity: SWATCH_OPACITIES[Math.min(rowIndex, SWATCH_OPACITIES.length - 1)] ?? 1,
        path: `M${points.join(" L")}`,
      };
    });
  }, [chronological, optionRows]);

  if (polls.length < 3 || optionRows.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:flex-row md:items-center">
      <div className="h-32 w-full overflow-hidden rounded bg-[var(--admin-surface-variant)] md:w-2/3">
        <svg
          className="h-full w-full stroke-[var(--admin-primary)]"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          {series.map((line) => (
            <path
              key={line.key}
              d={line.path}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: line.opacity }}
            />
          ))}
        </svg>
      </div>
      <div className="w-full md:w-1/3">
        <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
          Trend summary
        </h3>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {insight ?? "Option shares across the selected polls in chronological order."}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {series.map((line) => (
            <li
              key={line.key}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--admin-border)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]"
            >
              <span
                className="h-2 w-2 rounded-full bg-[var(--admin-primary)]"
                style={{ opacity: line.opacity }}
              />
              <span className="max-w-[120px] truncate">{line.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AdminPollsComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickerId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedIds = useMemo(() => parseIdsParam(searchParams.get("pollIds")), [searchParams]);
  const alignBy = (searchParams.get("alignBy") as PollCompareAlignBy | null) ?? "label";

  const [data, setData] = useState<PollsCompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFields, setShowFields] = useState<ShowField[]>(["shares", "counts"]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOptions, setPickerOptions] = useState<PollListItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [slotMeta, setSlotMeta] = useState<Record<string, PollListItem>>({});

  const canCompare = selectedIds.length >= 2;

  const syncUrl = useCallback(
    (ids: string[], nextAlign: PollCompareAlignBy = alignBy) => {
      const qs = new URLSearchParams();
      if (ids.length > 0) qs.set("pollIds", ids.join(","));
      if (nextAlign !== "label") qs.set("alignBy", nextAlign);
      const query = qs.toString();
      router.replace(
        query ? `/admin/reports/polls/compare?${query}` : "/admin/reports/polls/compare",
      );
    },
    [alignBy, router],
  );

  const loadCompare = useCallback(async (ids: string[], nextAlign: PollCompareAlignBy) => {
    if (ids.length < 2) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPollsCompare(ids, nextAlign);
      setData(response.data);
    } catch (err) {
      setData(null);
      setError(err instanceof ClientApiError ? err.message : "Could not load poll comparison.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompare(selectedIds, alignBy === "order" ? "order" : "label");
  }, [selectedIds, alignBy, loadCompare]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
    };
  }, [pickerOpen]);

  const searchPicker = useCallback(async (q: string) => {
    setPickerLoading(true);
    try {
      const response = await fetchPollsRoster({
        ...(q.trim() ? { q: q.trim() } : {}),
        page: 1,
        limit: 40,
        view: "all",
      });
      setPickerOptions(response.data.items);
      setSlotMeta((prev) => {
        const next = { ...prev };
        for (const item of response.data.items) next[item.id] = item;
        return next;
      });
    } catch {
      setPickerOptions([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const handle = window.setTimeout(() => {
      void searchPicker(pickerQuery);
    }, 200);
    return () => {
      window.clearTimeout(handle);
    };
  }, [pickerOpen, pickerQuery, searchPicker]);

  useEffect(() => {
    const missing = selectedIds.filter(
      (id) => !slotMeta[id] && !data?.polls.some((p) => p.id === id),
    );
    if (missing.length === 0) return;
    void (async () => {
      try {
        const response = await fetchPollsRoster({ page: 1, limit: 50, view: "all" });
        setSlotMeta((prev) => {
          const next = { ...prev };
          for (const item of response.data.items) {
            if (missing.includes(item.id) || selectedIds.includes(item.id)) {
              next[item.id] = item;
            }
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
  }, [selectedIds, slotMeta, data]);

  const addPoll = (id: string) => {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_SLOTS) return;
    const next = [...selectedIds, id];
    syncUrl(next);
    setPickerOpen(false);
    setPickerQuery("");
  };

  const removePoll = (id: string) => {
    syncUrl(selectedIds.filter((entry) => entry !== id));
  };

  const handleSave = () => {
    if (selectedIds.length < 2) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ pollIds: selectedIds, alignBy, savedAt: new Date().toISOString() }),
      );
      setSaveMessage("Comparison saved in this browser.");
      window.setTimeout(() => {
        setSaveMessage(null);
      }, 2500);
    } catch {
      setSaveMessage("Could not save comparison locally.");
    }
  };

  const handleRestore = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        setSaveMessage("No saved comparison found.");
        return;
      }
      const parsed = JSON.parse(raw) as { pollIds?: string[]; alignBy?: PollCompareAlignBy };
      const ids = Array.isArray(parsed.pollIds) ? parseIdsParam(parsed.pollIds.join(",")) : [];
      if (ids.length < 2) {
        setSaveMessage("Saved comparison is incomplete.");
        return;
      }
      syncUrl(ids, parsed.alignBy === "order" ? "order" : "label");
      setSaveMessage("Restored saved comparison.");
      window.setTimeout(() => {
        setSaveMessage(null);
      }, 2500);
    } catch {
      setSaveMessage("Could not restore saved comparison.");
    }
  };

  const pickerGroups = useMemo(
    () => groupPickerOptions(pickerOptions, selectedIds),
    [pickerOptions, selectedIds],
  );

  const totalResponses = data?.polls.reduce((sum, poll) => sum + poll.responseCount, 0) ?? 0;

  const moduleTabs = (
    <div className="border-b border-[var(--admin-border)]">
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Polls module">
        {(
          [
            ["polls", "Polls", "/admin/reports/polls"],
            ["live", "Live Sessions", "/admin/reports/polls/live-sessions"],
            ["compare", "Compare", "/admin/reports/polls/compare"],
            ["exports", "Exports", "/admin/reports/polls/exports"],
          ] as const
        ).map(([value, label, href]) => (
          <Link
            key={value}
            href={href}
            role="tab"
            aria-selected={value === "compare"}
            className={[
              "inline-flex h-10 items-center whitespace-nowrap px-6 text-sm font-semibold transition-colors",
              value === "compare"
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
            ].join(" ")}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8">
      <nav
        className="flex flex-wrap items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports/polls" className="hover:text-[var(--admin-primary)]">
          Polls
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Compare</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
            <Link
              href="/admin/reports/polls"
              className="inline-flex items-center gap-1 transition-colors hover:text-[var(--admin-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Polls
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Compare polls
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Put two to four polls side by side — useful when the same question runs across sessions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={!data || data.polls.length < 2}
            onClick={() => {
              if (data) downloadCsv(data);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export comparison
          </button>
          <button type="button" className={ghostButtonClassName} onClick={handleRestore}>
            Restore saved
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={selectedIds.length < 2}
            onClick={handleSave}
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            Save comparison
          </button>
        </div>
      </div>

      {saveMessage ? (
        <p className="text-xs text-[var(--admin-success)]" role="status">
          {saveMessage}
        </p>
      ) : null}

      {moduleTabs}

      <div
        className="relative rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4"
        ref={pickerRef}
      >
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
          <div className="inline-flex items-center gap-2">
            <span id={`${pickerId}-align-label`}>Align options by</span>
            <Select
              id={`${pickerId}-align`}
              ariaLabelledby={`${pickerId}-align-label`}
              value={alignBy === "order" ? "order" : "label"}
              onValueChange={(value) => {
                syncUrl(selectedIds, value === "order" ? "order" : "label");
              }}
              options={[
                { value: "label", label: "Option label" },
                { value: "order", label: "Option order" },
              ]}
              className="h-8 min-w-[140px] text-xs"
            />
          </div>
          <div className="inline-flex items-center gap-3">
            <span>Show</span>
            {(
              [
                ["shares", "Shares"],
                ["counts", "Counts"],
              ] as const
            ).map(([value, label]) => {
              const checked = showFields.includes(value);
              return (
                <label key={value} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    checked={checked}
                    onChange={() => {
                      setShowFields((prev) => {
                        if (checked) {
                          const next = prev.filter((entry) => entry !== value);
                          return next.length > 0 ? next : prev;
                        }
                        return [...prev, value];
                      });
                    }}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(data?.polls ?? []).map((poll, index) => (
            <div
              key={poll.id}
              className="relative flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3"
            >
              <div
                className="absolute left-0 top-0 h-1 w-full rounded-t-lg bg-[var(--admin-primary)]"
                style={{ opacity: SWATCH_OPACITIES[index] }}
              />
              <div className="mt-1 mb-2 flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  {poll.shortName}
                </span>
                <button
                  type="button"
                  className="text-[var(--admin-outline)] transition-colors hover:text-[var(--admin-danger)]"
                  aria-label={`Remove ${poll.title}`}
                  onClick={() => {
                    removePoll(poll.id);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-[var(--admin-on-surface)]">
                {poll.title}
              </h3>
              <div className="mt-auto space-y-1 text-xs text-[var(--admin-on-surface-variant)]">
                <div className="flex justify-between gap-2">
                  <span>Session</span>
                  <span className="truncate text-right text-[var(--admin-on-surface)]">
                    {poll.liveSessionTitle ?? "Standalone"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Date</span>
                  <span className="font-mono text-[var(--admin-on-surface)]">
                    {formatShortDate(poll.openedAt)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Count</span>
                  <span className="font-mono text-[var(--admin-on-surface)]">
                    {poll.responseCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {!data &&
            selectedIds.map((id) => {
              const meta = slotMeta[id];
              return (
                <div
                  key={id}
                  className="flex min-h-[140px] flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-semibold text-[var(--admin-on-surface)]">
                      {meta?.title ?? `${id.slice(0, 8)}…`}
                    </span>
                    <button
                      type="button"
                      className="text-[var(--admin-outline)] hover:text-[var(--admin-danger)]"
                      aria-label="Remove poll"
                      onClick={() => {
                        removePoll(id);
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    {meta?.liveSessionTitle ?? "Loading…"}
                  </p>
                </div>
              );
            })}

          {selectedIds.length === 0 ? (
            <button
              type="button"
              className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface)] p-3 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
              onClick={() => {
                setPickerOpen(true);
              }}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Add poll
            </button>
          ) : null}

          {selectedIds.length < MAX_SLOTS ? (
            <button
              type="button"
              id={pickerId}
              className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface)] p-3 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
              onClick={() => {
                setPickerOpen((open) => !open);
              }}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Add poll
            </button>
          ) : null}
        </div>

        {pickerOpen && selectedIds.length < MAX_SLOTS ? (
          <div className="absolute left-4 right-4 z-30 mt-2 max-h-80 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg md:left-auto md:right-4 md:w-[min(100%-2rem,28rem)]">
            <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--admin-outline)]" aria-hidden="true" />
              <input
                value={pickerQuery}
                onChange={(event) => {
                  setPickerQuery(event.target.value);
                }}
                placeholder="Search polls…"
                className="h-8 w-full bg-transparent text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-outline)]"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-2" role="listbox" aria-labelledby={pickerId}>
              {pickerLoading ? (
                <p className="px-2 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                  Searching…
                </p>
              ) : pickerGroups.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                  No matching polls.
                </p>
              ) : (
                pickerGroups.map((group) => (
                  <div key={group.key} className="mb-2">
                    {group.polls.length > 1 ? (
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Same question · {group.polls.length}
                      </p>
                    ) : null}
                    {group.polls.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        className="flex w-full flex-col gap-0.5 rounded px-2 py-2 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                        onClick={() => {
                          addPoll(item.id);
                        }}
                      >
                        <span className="line-clamp-1 text-sm font-medium text-[var(--admin-on-surface)]">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                          {(item.liveSessionTitle ?? "Standalone") +
                            " · " +
                            formatShortDate(item.createdAt) +
                            " · " +
                            item.responseCount.toLocaleString() +
                            " responses"}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? <CompareSkeleton /> : null}

      {!loading && !canCompare ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-outline)]">
            <GitCompareArrows className="h-10 w-10" aria-hidden="true" strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Pick at least two polls to compare
          </h2>
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Select polls from the slots above to view side-by-side analytics and response
            distributions. Matching question text is grouped in the picker for easier pairing.
          </p>
        </div>
      ) : null}

      {!loading && data && canCompare ? (
        <>
          {!data.optionsAligned ? (
            <div
              className="flex items-start gap-3 rounded-r border border-[var(--admin-danger)]/20 border-l-[3px] border-l-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-4"
              role="status"
            >
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
                aria-hidden="true"
              />
              <p className="text-sm text-[var(--admin-on-surface)]">
                <strong className="font-semibold">Mismatched datasets:</strong> These polls do not
                share the same options — only participation and response counts can be compared.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="flex flex-col gap-6 xl:col-span-7">
              <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Response distribution
                  </h2>
                </div>
                {data.optionsAligned ? (
                  <>
                    <div className="flex flex-col gap-8 p-5">
                      {data.optionRows.map((row) => (
                        <div key={row.key} className="flex flex-col gap-2">
                          <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                            {row.label}
                          </h4>
                          {row.cells.map((cell, cellIndex) => {
                            const poll = data.polls.find((entry) => entry.id === cell.pollId);
                            const width = Math.min(100, Math.max(0, cell.percent ?? 0));
                            return (
                              <div
                                key={`${row.key}-${cell.pollId}`}
                                className="flex flex-wrap items-center gap-3 sm:flex-nowrap"
                              >
                                <div className="w-14 shrink-0 text-right text-xs text-[var(--admin-on-surface-variant)]">
                                  {poll?.shortName ?? `Poll ${cellIndex + 1}`}
                                </div>
                                <div className="h-6 min-w-[120px] flex-1 overflow-hidden rounded bg-[var(--admin-surface-variant)]">
                                  <div
                                    className="h-full rounded bg-[var(--admin-primary)] transition-[width] duration-300"
                                    style={{
                                      width: `${width}%`,
                                      opacity: SWATCH_OPACITIES[cellIndex],
                                    }}
                                  />
                                </div>
                                <div className="flex w-full shrink-0 justify-end gap-3 sm:w-auto">
                                  {showFields.includes("shares") ? (
                                    <span className="w-16 text-right font-mono text-sm tabular-nums text-[var(--admin-on-surface)]">
                                      {cell.percent == null ? "—" : `${cell.percent}%`}
                                    </span>
                                  ) : null}
                                  {showFields.includes("counts") ? (
                                    <span className="w-12 text-right font-mono text-xs tabular-nums text-[var(--admin-on-surface-variant)]">
                                      {cell.count == null ? "—" : cell.count.toLocaleString()}
                                    </span>
                                  ) : null}
                                  <span
                                    className={[
                                      "w-20 text-right font-mono text-xs tabular-nums",
                                      deltaTone(cell.deltaPctVsLeft, true) === "up"
                                        ? "text-[var(--admin-success)]"
                                        : deltaTone(cell.deltaPctVsLeft, true) === "down"
                                          ? "text-[var(--admin-danger)]"
                                          : "text-[var(--admin-on-surface-variant)]",
                                    ].join(" ")}
                                  >
                                    {cellIndex === 0
                                      ? ""
                                      : (formatDelta(cell.deltaPctVsLeft, "pts") ?? "")}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-5 py-3 text-center text-xs text-[var(--admin-on-surface-variant)]">
                      Comparison includes {totalResponses.toLocaleString()} total responses across{" "}
                      {data.polls.length} polls.
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[220px] flex-col items-center justify-center bg-[var(--admin-surface-low)] p-8 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]">
                      <Ban className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                      Detailed option comparison is unavailable
                    </h3>
                    <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                      Because these polls use mismatched option sets, row-by-row comparison is
                      disabled to keep the view honest.
                    </p>
                  </div>
                )}
              </div>

              {data.optionsAligned ? (
                <TrendStrip
                  polls={data.polls}
                  optionRows={data.optionRows}
                  insight={data.trendInsight}
                />
              ) : null}
            </div>

            <div className="xl:col-span-5">
              <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    {data.optionsAligned ? "Engagement metrics" : "High-level metric comparison"}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)]">
                        <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Metric
                        </th>
                        {data.polls.map((poll, index) => (
                          <th
                            key={poll.id}
                            className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
                          >
                            {poll.shortName}
                            {index === 0 && data.polls.length === 2 ? (
                              <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal">
                                Baseline
                              </span>
                            ) : null}
                          </th>
                        ))}
                        {data.polls.length === 2 ? (
                          <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Delta
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map((metric) => {
                        const values = data.polls.map((poll) => metricValue(poll, metric.key));
                        const baseline = values[0] ?? null;
                        const hideCorrect =
                          metric.key === "correctPct" && data.polls.every((poll) => !poll.quizMode);
                        if (hideCorrect) {
                          return (
                            <tr
                              key={metric.key}
                              className="border-b border-[var(--admin-border)] last:border-b-0"
                            >
                              <td className="px-4 py-3 text-sm text-[var(--admin-on-surface)]">
                                {metric.label}
                              </td>
                              {data.polls.map((poll) => (
                                <td
                                  key={poll.id}
                                  className="px-4 py-3 text-right font-mono text-sm text-[var(--admin-on-surface-variant)]"
                                >
                                  —
                                </td>
                              ))}
                              {data.polls.length === 2 ? (
                                <td className="px-4 py-3 text-right font-mono text-sm text-[var(--admin-on-surface-variant)]">
                                  —
                                </td>
                              ) : null}
                            </tr>
                          );
                        }
                        const maxAbs = Math.max(
                          ...values.map((value) => (value == null ? 0 : Math.abs(value))),
                          0,
                        );
                        return (
                          <tr
                            key={metric.key}
                            className="border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                          >
                            <td className="px-4 py-3 text-sm text-[var(--admin-on-surface)]">
                              {metric.label}
                            </td>
                            {data.polls.map((poll, index) => {
                              const value = values[index] ?? null;
                              const delta =
                                index > 0
                                  ? value != null && baseline != null
                                    ? value - baseline
                                    : null
                                  : null;
                              const barPct =
                                value != null && maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0;
                              const tone = deltaTone(delta, metric.higherIsBetter);
                              return (
                                <td key={poll.id} className="px-4 py-3 text-right align-middle">
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="font-mono text-sm tabular-nums text-[var(--admin-on-surface)]">
                                      {formatMetric(value, metric.format)}
                                    </span>
                                    {metric.format === "pct" && value != null ? (
                                      <span className="block h-0.5 w-16 overflow-hidden rounded bg-[var(--admin-surface-variant)]">
                                        <span
                                          className="block h-full bg-[var(--admin-primary)]"
                                          style={{
                                            width: `${barPct}%`,
                                            opacity: SWATCH_OPACITIES[index],
                                          }}
                                        />
                                      </span>
                                    ) : null}
                                    {index > 0 && data.polls.length > 2 ? (
                                      <span
                                        className={[
                                          "font-mono text-[11px] tabular-nums",
                                          tone === "up"
                                            ? "text-[var(--admin-success)]"
                                            : tone === "down"
                                              ? "text-[var(--admin-danger)]"
                                              : "text-[var(--admin-on-surface-variant)]",
                                        ].join(" ")}
                                      >
                                        {formatDelta(delta, metric.format) ?? ""}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                              );
                            })}
                            {data.polls.length === 2 ? (
                              <td className="px-4 py-3 text-right">
                                {(() => {
                                  const delta =
                                    values[1] != null && baseline != null
                                      ? values[1] - baseline
                                      : null;
                                  const tone = deltaTone(delta, metric.higherIsBetter);
                                  return (
                                    <span
                                      className={[
                                        "font-mono text-sm tabular-nums",
                                        tone === "up"
                                          ? "text-[var(--admin-success)]"
                                          : tone === "down"
                                            ? "text-[var(--admin-danger)]"
                                            : "text-[var(--admin-on-surface-variant)]",
                                      ].join(" ")}
                                    >
                                      {formatDelta(delta, metric.format) ?? "—"}
                                    </span>
                                  );
                                })()}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
