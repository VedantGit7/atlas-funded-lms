"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Download,
  Minus,
  MoreVertical,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  DEFAULT_OUTLIER_THRESHOLDS,
  dateInputToEndIso,
  dateInputToStartIso,
  fetchSuperLiveInsightsOutliers,
  previewSuperLiveInsightsOutliers,
  type SuperLiveInsightsOutlierCategory,
  type SuperLiveInsightsOutlierFinding,
  type SuperLiveInsightsOutlierThresholds,
  type SuperLiveInsightsOutliersData,
} from "./admin-super-live-insights-roster-api";
import { SuperLiveInsightsModuleTabs } from "./SuperLiveInsightsModuleTabs";

type DatePreset = "7d" | "30d" | "90d" | "custom";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const monoFieldClassName =
  "h-8 w-16 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const THRESHOLDS_KEY = "atlas.super-live-insights.outliers.thresholds.v1";
const DISMISS_KEY = "atlas.super-live-insights.outliers.dismissed.v1";
const SNOOZE_KEY = "atlas.super-live-insights.outliers.snoozed.v1";

const PERFORMANCE_CATEGORIES: Array<{
  id: SuperLiveInsightsOutlierCategory;
  label: string;
}> = [
  { id: "all", label: "All findings" },
  { id: "far_below", label: "Far below benchmark" },
  { id: "far_above", label: "Far above benchmark" },
];

const DATA_QUALITY_CATEGORIES: Array<{
  id: SuperLiveInsightsOutlierCategory;
  label: string;
}> = [
  { id: "unresolved", label: "Unresolved records" },
  { id: "no_records", label: "No attendance records" },
  { id: "short_duration", label: "Very short avg duration" },
  { id: "started_late", label: "Started very late" },
];

function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite]",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent",
        "motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  else if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function severityMeta(severity: SuperLiveInsightsOutlierFinding["severity"]) {
  if (severity === "data_quality") {
    return {
      label: "Data Quality",
      rail: "var(--admin-danger)",
      pill: "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)] border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))]",
    };
  }
  if (severity === "notable") {
    return {
      label: "Notable",
      rail: "var(--admin-warning)",
      pill: "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)] border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))]",
    };
  }
  return {
    label: "Worth Checking",
    rail: "var(--admin-primary)",
    pill: "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)] border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))]",
  };
}

function evidenceToneClass(tone: SuperLiveInsightsOutlierFinding["evidence"][number]["tone"]) {
  switch (tone) {
    case "success":
      return "text-[var(--admin-success)]";
    case "warning":
      return "text-[var(--admin-warning)]";
    case "danger":
      return "text-[var(--admin-danger)]";
    case "ink":
      return "font-medium text-[var(--admin-on-surface)]";
    case "muted":
      return "text-[var(--admin-on-surface-variant)]";
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

function downloadFindingsCsv(findings: SuperLiveInsightsOutlierFinding[]) {
  const header = [
    "finding_id",
    "session_id",
    "category",
    "severity",
    "title",
    "session_title",
    "course_title",
    "batch_name",
    "scheduled_at",
    "attended",
    "registered",
    "absent",
    "total",
    "attendance_rate",
    "course_avg_rate",
  ];
  const rows = findings.map((finding) =>
    [
      finding.id,
      finding.sessionId,
      finding.category,
      finding.severity,
      finding.title,
      finding.sessionTitle,
      finding.courseTitle ?? "",
      finding.batchName ?? "",
      finding.scheduledAt ?? "",
      finding.composition.attendedCount,
      finding.composition.registeredCount,
      finding.composition.absentCount,
      finding.composition.totalCount,
      finding.metrics.attendanceRate ?? "",
      finding.metrics.courseAvgRate ?? "",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `super-live-insights-outliers-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function CompositionBar({
  composition,
}: {
  composition: SuperLiveInsightsOutlierFinding["composition"];
}) {
  const total = composition.totalCount;
  if (total <= 0) return null;
  const attended = (composition.attendedCount / total) * 100;
  const registered = (composition.registeredCount / total) * 100;
  const absent = (composition.absentCount / total) * 100;
  return (
    <div
      className="flex h-1.5 w-32 overflow-hidden rounded-full bg-[var(--admin-surface-low)]"
      aria-hidden="true"
    >
      <div className="bg-[var(--admin-success)]" style={{ width: `${attended}%` }} />
      <div className="bg-[var(--admin-warning)]" style={{ width: `${registered}%` }} />
      <div className="bg-[var(--admin-danger)]" style={{ width: `${absent}%` }} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-hidden lg:flex-row">
      <div className="w-full shrink-0 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:w-[220px]">
        <div className="border-b border-[var(--admin-border)] p-4">
          <Shimmer className="mb-2 h-4 w-2/3" />
          <Shimmer className="h-8 w-full" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Shimmer className="h-4 w-4 rounded-full" />
              <Shimmer className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="relative h-28 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <div className="absolute inset-0 opacity-40">
              <Shimmer className="h-full w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingMenu({
  finding,
  onDismiss,
  onSnooze,
}: {
  finding: SuperLiveInsightsOutlierFinding;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Finding actions"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-outline)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className={`absolute top-9 right-0 z-20 w-52 bg-[var(--admin-surface)] shadow-lg ${dropdownPanelSurfaceClassName}`}
          role="menu"
        >
          <div className="p-1.5">
            <Link
              href={`/admin/reports/super-live-insights/${finding.sessionId}`}
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
              }}
            >
              Open session insight
            </Link>
            <Link
              href={`/admin/reports/live-class-attendance/${finding.sessionId}`}
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
              }}
            >
              View attendees
            </Link>
            <Link
              href={`/admin/reports/super-live-insights/compare?mode=sessions&ids=${finding.sessionId}`}
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
              }}
            >
              Compare with peers
            </Link>
            <button
              type="button"
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
                onDismiss();
              }}
            >
              Dismiss finding
            </button>
            <button
              type="button"
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
                onSnooze();
              }}
            >
              Snooze this session
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetectionSettingsDrawer({
  open,
  startedFrom,
  startedTo,
  draft,
  onChange,
  onClose,
  onReset,
  onSave,
}: {
  open: boolean;
  startedFrom: string;
  startedTo: string;
  draft: SuperLiveInsightsOutlierThresholds;
  onChange: (next: SuperLiveInsightsOutlierThresholds) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setPreviewBusy(true);
        try {
          const fromIso = dateInputToStartIso(startedFrom);
          const toIso = dateInputToEndIso(startedTo);
          if (!fromIso || !toIso) return;
          const response = await previewSuperLiveInsightsOutliers({
            startedFrom: fromIso,
            startedTo: toIso,
            thresholds: draft,
          });
          if (!cancelled) setPreviewCount(response.data.findingCount);
        } catch {
          if (!cancelled) setPreviewCount(null);
        } finally {
          if (!cancelled) setPreviewBusy(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft, open, startedFrom, startedTo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close detection settings"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_28%,transparent)] backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="outlier-detection-settings-title"
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_24px_80px_color-mix(in_srgb,var(--admin-on-surface)_18%,transparent)] motion-safe:translate-x-0"
      >
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 md:px-8">
          <h2
            id="outlier-detection-settings-title"
            className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
          >
            Detection settings
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6 md:p-8">
          <section className="space-y-4">
            <h3 className="border-b border-[var(--admin-border)] pb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              Performance Thresholds
            </h3>
            <label className="flex flex-col gap-1 text-sm text-[var(--admin-on-surface-variant)]">
              <span className="flex flex-wrap items-center gap-2">
                Flag a session when its rate is more than
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={monoFieldClassName}
                  value={draft.rateDeltaPts}
                  onChange={(event) => {
                    onChange({
                      ...draft,
                      rateDeltaPts: Number(event.target.value) || 1,
                    });
                  }}
                />
                points from its course average
              </span>
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                Points deviate from the course mean.
              </span>
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
              Flag when average duration is under
              <input
                type="number"
                min={1}
                max={100}
                className={monoFieldClassName}
                value={draft.shortDurationPct}
                onChange={(event) => {
                  onChange({
                    ...draft,
                    shortDurationPct: Number(event.target.value) || 1,
                  });
                }}
              />
              % of the session length
            </label>
          </section>

          <section className="space-y-4">
            <h3 className="border-b border-[var(--admin-border)] pb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              Data Quality Thresholds
            </h3>
            <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
              Flag when unresolved registered records exceed
              <input
                type="number"
                min={1}
                max={100}
                className={monoFieldClassName}
                value={draft.unresolvedPct}
                onChange={(event) => {
                  onChange({
                    ...draft,
                    unresolvedPct: Number(event.target.value) || 1,
                  });
                }}
              />
              % of total
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
              Flag when a session started more than
              <input
                type="number"
                min={1}
                max={240}
                className={monoFieldClassName}
                value={draft.lateStartMinutes}
                onChange={(event) => {
                  onChange({
                    ...draft,
                    lateStartMinutes: Number(event.target.value) || 1,
                  });
                }}
              />
              minutes late
            </label>
            <div className="space-y-1 pt-2">
              <label className="flex cursor-pointer flex-wrap items-center gap-3 text-sm text-[var(--admin-on-surface-variant)]">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.ignoreSmallSessions}
                  className={[
                    "relative h-5 w-10 rounded-full transition-colors",
                    draft.ignoreSmallSessions
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-surface-high))]"
                      : "bg-[var(--admin-surface-high)]",
                  ].join(" ")}
                  onClick={() => {
                    onChange({
                      ...draft,
                      ignoreSmallSessions: !draft.ignoreSmallSessions,
                    });
                  }}
                >
                  <span
                    className={[
                      "absolute top-0 left-0 h-5 w-5 rounded-full border-2 bg-[var(--admin-surface)] transition-transform",
                      draft.ignoreSmallSessions
                        ? "translate-x-5 border-[var(--admin-primary)]"
                        : "translate-x-0 border-[var(--admin-outline)]",
                    ].join(" ")}
                  />
                </button>
                <span className="flex flex-wrap items-center gap-2">
                  Ignore sessions with fewer than
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    className={monoFieldClassName}
                    value={draft.minRecords}
                    disabled={!draft.ignoreSmallSessions}
                    onChange={(event) => {
                      onChange({
                        ...draft,
                        minRecords: Number(event.target.value) || 0,
                      });
                    }}
                  />
                  records
                </span>
              </label>
              <p className="ml-14 text-xs text-[var(--admin-on-surface-variant)]">
                Small sessions produce noisy rates.
              </p>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4 md:px-8">
          <button type="button" className={secondaryButtonClassName} onClick={onReset}>
            Reset to defaults
          </button>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <span className="font-mono text-xs text-[var(--admin-warning)]">
              {previewBusy
                ? "Calculating…"
                : previewCount == null
                  ? "Preview unavailable"
                  : `Current thresholds would produce ${previewCount.toLocaleString()} findings.`}
            </span>
            <button type="button" className={primaryButtonClassName} onClick={onSave}>
              Save thresholds
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

export function AdminSuperLiveInsightsOutliersPage() {
  const router = useRouter();
  const datePresetLabelId = useId();
  const initial = presetToRange("30d");

  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [startedFrom, setStartedFrom] = useState(initial.from);
  const [startedTo, setStartedTo] = useState(initial.to);
  const [category, setCategory] = useState<SuperLiveInsightsOutlierCategory>("all");
  const [thresholds, setThresholds] = useState<SuperLiveInsightsOutlierThresholds>(
    DEFAULT_OUTLIER_THRESHOLDS,
  );
  const [draftThresholds, setDraftThresholds] = useState<SuperLiveInsightsOutlierThresholds>(
    DEFAULT_OUTLIER_THRESHOLDS,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuperLiveInsightsOutliersData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = readJson<Partial<SuperLiveInsightsOutlierThresholds>>(THRESHOLDS_KEY, {});
    const next = { ...DEFAULT_OUTLIER_THRESHOLDS, ...stored };
    setThresholds(next);
    setDraftThresholds(next);
    setDismissed(readJson<string[]>(DISMISS_KEY, []));
    setSnoozed(readJson<Record<string, number>>(SNOOZE_KEY, {}));
  }, []);

  const applyPreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = presetToRange(preset);
    setStartedFrom(range.from);
    setStartedTo(range.to);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromIso = dateInputToStartIso(startedFrom);
      const toIso = dateInputToEndIso(startedTo);
      if (!fromIso || !toIso) throw new Error("Select a valid date range.");
      const response = await fetchSuperLiveInsightsOutliers({
        startedFrom: fromIso,
        startedTo: toIso,
        category,
        thresholds,
      });
      setData(response.data);
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load outlier findings.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [category, startedFrom, startedTo, thresholds]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleFindings = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return data.findings.filter((finding) => {
      if (dismissed.includes(finding.id)) return false;
      const until = snoozed[finding.sessionId];
      if (until && until > now) return false;
      return true;
    });
  }, [data, dismissed, snoozed]);

  const selectedFinding = visibleFindings.find((finding) => finding.id === selectedId) ?? null;

  const datePresetLabel =
    datePreset === "7d"
      ? "Last 7 days"
      : datePreset === "30d"
        ? "Last 30 days"
        : datePreset === "90d"
          ? "Last 90 days"
          : "Custom range";

  const counts = data?.counts;

  const dismissFinding = (id: string) => {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    writeJson(DISMISS_KEY, next);
    if (selectedId === id) setSelectedId(null);
  };

  const snoozeSession = (sessionId: string) => {
    const next = { ...snoozed, [sessionId]: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    setSnoozed(next);
    writeJson(SNOOZE_KEY, next);
    if (selectedFinding?.sessionId === sessionId) setSelectedId(null);
  };

  const renderTriageItem = (item: { id: SuperLiveInsightsOutlierCategory; label: string }) => {
    const selected = category === item.id;
    const count = counts?.[item.id] ?? 0;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setCategory(item.id);
        }}
        className={[
          "flex w-full items-center justify-between border-l-2 px-4 py-2 text-left text-sm transition-colors",
          selected
            ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] font-medium text-[var(--admin-primary)]"
            : "border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
        ].join(" ")}
      >
        <span>{item.label}</span>
        <span className="font-mono text-[13px] tabular-nums">{count}</span>
      </button>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Outliers
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Sessions that deviate from the tenant benchmark, and records that need cleaning up.
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
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <Calendar
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden
                  />
                  <span className="flex-1 text-left">{datePresetLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${dateMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden
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
                    ["custom", "Custom range"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={datePreset === value}
                    className={dropdownItemClassName}
                    onClick={() => {
                      applyPreset(value);
                      setDateMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>

          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              setDraftThresholds(thresholds);
              setSettingsOpen(true);
            }}
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            Detection settings
          </button>

          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={!visibleFindings.length}
            onClick={() => {
              downloadFindingsCsv(visibleFindings);
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>

          <button
            type="button"
            className={primaryButtonClassName}
            disabled={!selectedFinding}
            onClick={() => {
              if (!selectedFinding) return;
              router.push(`/admin/reports/live-class-attendance/${selectedFinding.sessionId}`);
            }}
          >
            <Users className="h-4 w-4" aria-hidden />
            View attendees
          </button>
        </div>
      </div>

      {datePreset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            From
            <input
              type="date"
              className={fieldClassName}
              value={startedFrom}
              onChange={(event) => {
                setStartedFrom(event.target.value);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            To
            <input
              type="date"
              className={fieldClassName}
              value={startedTo}
              onChange={(event) => {
                setStartedTo(event.target.value);
              }}
            />
          </label>
        </div>
      ) : null}

      <SuperLiveInsightsModuleTabs active="outliers" />

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="text-sm font-bold text-[var(--admin-danger)] underline-offset-2 hover:underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <LoadingSkeleton /> : null}

      {!loading && !error && data ? (
        <div className="flex min-h-[520px] flex-col gap-4 lg:flex-row lg:gap-0">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {[...PERFORMANCE_CATEGORIES, ...DATA_QUALITY_CATEGORIES].map((item) => {
              const selected = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCategory(item.id);
                  }}
                  className={[
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    selected
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                >
                  {item.label}
                  <span className="ml-2 font-mono tabular-nums">{counts?.[item.id] ?? 0}</span>
                </button>
              );
            })}
          </div>

          <aside className="hidden w-[220px] shrink-0 flex-col overflow-hidden rounded-l-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:flex">
            <div className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Performance
              </h2>
            </div>
            <nav className="py-2">{PERFORMANCE_CATEGORIES.map(renderTriageItem)}</nav>
            <div className="sticky top-0 mt-2 border-y border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Data Quality
              </h2>
            </div>
            <nav className="flex-1 py-2">{DATA_QUALITY_CATEGORIES.map(renderTriageItem)}</nav>
            <div className="mt-auto border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <div className="flex items-start gap-2 text-[var(--admin-warning)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p className="text-xs leading-relaxed">
                  {data.dataQualityRecordsAffected.toLocaleString()} attendance records affected by
                  data-quality findings
                </p>
              </div>
            </div>
          </aside>

          <main className="relative flex-1 overflow-y-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 lg:rounded-l-none lg:border-l-0 lg:p-8">
            {visibleFindings.length === 0 ? (
              <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
                <div
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: "radial-gradient(var(--admin-outline) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                <div className="relative z-10 flex max-w-md flex-col items-center gap-5">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] shadow-[inset_0_1px_2px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]">
                    <Minus
                      className="h-12 w-12 text-[var(--admin-on-surface-variant)]"
                      strokeWidth={1.25}
                    />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                      Nothing stands out in this range
                    </h2>
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      All sessions sit within the thresholds you set.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() => {
                      setDraftThresholds(thresholds);
                      setSettingsOpen(true);
                    }}
                  >
                    <Settings2 className="h-4 w-4" aria-hidden />
                    Detection settings
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-[1000px] flex-col gap-3 pb-10">
                {visibleFindings.map((finding) => {
                  const meta = severityMeta(finding.severity);
                  const selected = selectedId === finding.id;
                  const subtitle = [finding.courseTitle, finding.batchName]
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <article
                      key={finding.id}
                      className={[
                        "relative flex overflow-hidden rounded-lg border bg-[var(--admin-surface)] transition-shadow",
                        selected
                          ? "border-[var(--admin-primary)] shadow-md"
                          : "border-[var(--admin-border)] hover:shadow-md",
                      ].join(" ")}
                    >
                      <div className="w-1 shrink-0" style={{ background: meta.rail }} />
                      <div className="flex flex-1 items-start justify-between gap-4 p-4">
                        <button
                          type="button"
                          className="min-w-0 flex-1 pr-2 text-left"
                          onClick={() => {
                            setSelectedId((current) =>
                              current === finding.id ? null : finding.id,
                            );
                          }}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider",
                                meta.pill,
                              ].join(" ")}
                            >
                              {meta.label}
                            </span>
                            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                              {finding.title}
                            </h3>
                          </div>
                          <p className="mb-3 text-sm text-[var(--admin-on-surface-variant)]">
                            {finding.sessionTitle}
                            {subtitle ? ` (${subtitle})` : ""}
                          </p>
                          <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {finding.evidence.map((chip, index) => (
                              <span
                                key={`${finding.id}-${index}`}
                                className="inline-flex items-center gap-2"
                              >
                                {index > 0 ? (
                                  <span className="text-[var(--admin-outline)]">|</span>
                                ) : null}
                                <span className={evidenceToneClass(chip.tone)}>{chip.label}</span>
                              </span>
                            ))}
                          </div>
                        </button>
                        <div className="flex shrink-0 flex-col items-end gap-3 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--admin-on-surface-variant)]">
                              {formatDate(finding.scheduledAt)}
                            </span>
                            <FindingMenu
                              finding={finding}
                              onDismiss={() => {
                                dismissFinding(finding.id);
                              }}
                              onSnooze={() => {
                                snoozeSession(finding.sessionId);
                              }}
                            />
                          </div>
                          <CompositionBar composition={finding.composition} />
                        </div>
                      </div>
                    </article>
                  );
                })}
                <p className="mt-4 text-center text-xs text-[var(--admin-on-surface-variant)]">
                  Learner-level detail lives in Live Class Attendance.
                </p>
              </div>
            )}
          </main>
        </div>
      ) : null}

      <DetectionSettingsDrawer
        open={settingsOpen}
        startedFrom={startedFrom}
        startedTo={startedTo}
        draft={draftThresholds}
        onChange={setDraftThresholds}
        onClose={() => {
          setSettingsOpen(false);
        }}
        onReset={() => {
          setDraftThresholds(DEFAULT_OUTLIER_THRESHOLDS);
        }}
        onSave={() => {
          setThresholds(draftThresholds);
          writeJson(THRESHOLDS_KEY, draftThresholds);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
