"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Info,
  Loader2,
  Play,
  Search,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { PII_DEFINITION_KEYS } from "./admin-exports-roster-api";
import { previewExportBuilder, type ExportBuilderPreview } from "./admin-export-builder-api";
import {
  cancelExportRun,
  fetchExportRunDetail,
  type ExportRunDetail,
} from "./admin-export-run-detail-api";
import {
  createReportSchedule,
  downloadReportExport,
  fetchAllReportDefinitions,
  startReportExportRun,
  type ReportDefinition,
  type ReportParamDefinition,
} from "./admin-reports-api";

type Phase = "configure" | "running" | "succeeded" | "failed";
type FormatOption = "csv" | "xlsx" | "json";
type DeliveryMode = "download" | "email" | "destination";
type EmptyValuesMode = "blank" | "placeholder";
type DatePreset = "7d" | "30d" | "90d" | "custom";
type SectionKey = "report" | "scope" | "columns" | "format" | "delivery";

type FilterRow = {
  id: string;
  field: string;
  operator: "eq" | "contains";
  value: string;
};

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const THEME_ORDER = ["Learners", "Commerce", "Live", "Operations"] as const;

const THEME_BY_KEY: Record<string, (typeof THEME_ORDER)[number]> = {
  enrollments: "Learners",
  "progress-score": "Learners",
  certificates: "Learners",
  "at-risk-roster": "Learners",
  "custom-field": "Learners",
  payments: "Commerce",
  "sales-marketing": "Commerce",
  "zoom-insights": "Live",
  "live-class-attendance": "Live",
  "super-live-insights": "Live",
  polls: "Live",
  batches: "Live",
  "resource-usage": "Operations",
  exports: "Operations",
  "active-devices": "Operations",
  "assessment-items": "Operations",
};

const PII_COLUMN_HINTS = [
  "email",
  "phone",
  "mobile",
  "address",
  "billing",
  "ip",
  "name",
  "learner_name",
  "display_name",
];

function isPiiColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return PII_COLUMN_HINTS.some((hint) => lower.includes(hint));
}

function themeFor(definition: ReportDefinition): (typeof THEME_ORDER)[number] {
  return THEME_BY_KEY[definition.key] ?? "Operations";
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function newFilterId(): string {
  return `f-${Math.random().toString(36).slice(2, 9)}`;
}

function datePresetRange(preset: Exclude<DatePreset, "custom">): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  from.setUTCDate(from.getUTCDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function dateParamKeys(params: ReportParamDefinition[]): { start?: string; end?: string } {
  const start =
    params.find((p) => /^(start|from|startedFrom|joinedFrom|paidFrom)/i.test(p.key))?.key ??
    params.find((p) => p.type === "date" && /start|from/i.test(p.key))?.key;
  const end =
    params.find((p) => /^(end|to|startedTo|joinedTo|paidTo)/i.test(p.key))?.key ??
    params.find((p) => p.type === "date" && /end|to/i.test(p.key))?.key;
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  };
}

function ModuleTabs({ active }: { active: "history" | "new" | "schedules" }) {
  const tabs = [
    { id: "history" as const, label: "History", href: "/admin/reports/exports", enabled: true },
    { id: "new" as const, label: "New export", href: "/admin/reports/exports/new", enabled: true },
    {
      id: "schedules" as const,
      label: "Schedules",
      href: "/admin/reports/exports/schedules",
      enabled: true,
    },
    {
      id: "destinations",
      label: "Destinations",
      href: "/admin/reports/exports/destinations",
      enabled: true,
    },
    {
      id: "settings",
      label: "Settings",
      href: "/admin/reports/exports/settings",
      enabled: true,
    },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--admin-border)]">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        if (!tab.enabled) {
          return (
            <span
              key={tab.id}
              className="px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)] opacity-50"
              title="Coming soon"
            >
              {tab.label}
            </span>
          );
        }
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-[var(--admin-primary-strong)] text-[var(--admin-primary-strong)]"
                : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function SectionHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)]">
          {step}
        </span>
        <h2 className="text-[16px] font-bold tracking-wider text-[var(--admin-on-surface)] uppercase">
          {title}
        </h2>
      </div>
      <p className="pl-8 text-[12px] text-[var(--admin-on-surface-variant)]">{description}</p>
    </div>
  );
}

function PipelineMini({
  stages,
}: {
  stages: Array<{ key: string; label: string; state: string }>;
}) {
  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.state === "current" || s.state === "failed"),
  );
  const progressPct = stages.every((s) => s.state === "complete")
    ? 100
    : Math.round(
        ((currentIndex + (stages[currentIndex]?.state === "complete" ? 1 : 0.5)) / stages.length) *
          100,
      );

  return (
    <div className="relative w-full max-w-2xl pt-2 pb-8">
      <div className="absolute top-4 right-4 left-4 h-0.5 bg-[var(--admin-border)]" />
      <div
        className="absolute top-4 left-4 h-0.5 bg-[var(--admin-primary-strong)] transition-all duration-500"
        style={{ width: `calc(${String(Math.min(progressPct, 100))}% - 2rem)` }}
      />
      <div className="relative z-10 flex justify-between">
        {stages.map((stage) => {
          const complete = stage.state === "complete";
          const current = stage.state === "current";
          const failed = stage.state === "failed";
          return (
            <div key={stage.key} className="flex w-16 flex-col items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full border-2 ${
                  complete || current
                    ? "border-[var(--admin-primary-strong)] bg-[var(--admin-primary-strong)]"
                    : failed
                      ? "border-[var(--admin-danger)] bg-[var(--admin-danger)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
                } ${current ? "motion-safe:animate-[admin-pipeline-pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" : ""}`}
              />
              <span
                className={`font-mono text-[10px] ${
                  current || failed
                    ? "font-semibold text-[var(--admin-on-surface)]"
                    : "text-[var(--admin-on-surface-variant)]"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminNewExportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillKey = searchParams.get("definition") ?? searchParams.get("report");

  const [phase, setPhase] = useState<Phase>("configure");
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportQuery, setReportQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reportCollapsed, setReportCollapsed] = useState(false);

  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [draftField, setDraftField] = useState("");
  const [draftOperator, setDraftOperator] = useState<"eq" | "contains">("eq");
  const [draftValue, setDraftValue] = useState("");
  const [fieldOpen, setFieldOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [datePresetOpen, setDatePresetOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rowLimit, setRowLimit] = useState("");

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [emptyValuesMode, setEmptyValuesMode] = useState<EmptyValuesMode>("blank");
  const [placeholderText, setPlaceholderText] = useState("-");

  const [format, setFormat] = useState<FormatOption>("csv");
  const [csvDelimiter, setCsvDelimiter] = useState(",");
  const [csvEncoding, setCsvEncoding] = useState("utf-8");
  const [xlsxOneSheet, setXlsxOneSheet] = useState(false);
  const [jsonShape, setJsonShape] = useState<"flat" | "nested">("flat");

  const [delivery, setDelivery] = useState<DeliveryMode>("download");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCadence, setScheduleCadence] = useState("daily");
  const [scheduleCadenceOpen, setScheduleCadenceOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("UTC");

  const [preview, setPreview] = useState<ExportBuilderPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("report");

  const [runDetail, setRunDetail] = useState<ExportRunDetail | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const fieldLabelId = useId();
  const operatorLabelId = useId();
  const dateLabelId = useId();
  const cadenceLabelId = useId();

  const selected = useMemo(
    () => definitions.find((d) => d.key === selectedKey) ?? null,
    [definitions, selectedKey],
  );

  const filterableParams = useMemo(() => {
    if (!selected) return [];
    const dates = dateParamKeys(selected.params);
    return selected.params.filter(
      (p) =>
        p.key !== dates.start &&
        p.key !== dates.end &&
        !["columns", "rowLimit", "limit", "format", "delivery"].includes(p.key),
    );
  }, [selected]);

  const availableColumns = useMemo(() => {
    if (preview?.columns.length) return preview.columns;
    return selected?.columns ?? [];
  }, [preview, selected]);

  const piiColumns = useMemo(() => availableColumns.filter(isPiiColumn), [availableColumns]);

  const groupedDefinitions = useMemo(() => {
    const q = reportQuery.trim().toLowerCase();
    const filtered = definitions.filter((d) => {
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.key.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      );
    });
    return THEME_ORDER.map((theme) => ({
      theme,
      items: filtered.filter((d) => themeFor(d) === theme),
    })).filter((group) => group.items.length > 0);
  }, [definitions, reportQuery]);

  const buildParams = useCallback((): Record<string, unknown> => {
    if (!selected) return {};
    const params: Record<string, unknown> = {};
    const dates = dateParamKeys(selected.params);

    for (const filter of filters) {
      if (!filter.field || !filter.value.trim()) continue;
      params[filter.field] =
        filter.operator === "contains" ? filter.value.trim() : filter.value.trim();
    }

    if (dates.start || dates.end) {
      const range =
        datePreset === "custom" ? { from: customFrom, to: customTo } : datePresetRange(datePreset);
      if (dates.start && range.from) {
        params[dates.start] = `${range.from}T00:00:00.000Z`;
      }
      if (dates.end && range.to) {
        params[dates.end] = `${range.to}T23:59:59.999Z`;
      }
    }

    if (selectedColumns.length > 0) {
      params["columns"] = selectedColumns;
    }
    if (rowLimit.trim()) {
      const limit = Number(rowLimit);
      if (Number.isFinite(limit) && limit > 0) params["rowLimit"] = Math.trunc(limit);
    }
    if (emptyValuesMode === "placeholder") {
      params["emptyValuePlaceholder"] = placeholderText;
    }
    if (format === "csv") {
      params["delimiter"] = csvDelimiter;
      params["encoding"] = csvEncoding;
    }
    if (format === "xlsx") {
      params["oneSheetPerGroup"] = xlsxOneSheet;
    }
    if (format === "json") {
      params["jsonShape"] = jsonShape;
    }
    params["delivery"] = {
      kind:
        delivery === "email" ? "email" : delivery === "destination" ? "storage" : "download_only",
    };
    if (filters.length > 0) {
      params["filterSummary"] = filters
        .map((f) => `${f.field} ${f.operator === "eq" ? "is" : "contains"} ${f.value}`)
        .join("; ");
    }
    return params;
  }, [
    selected,
    filters,
    datePreset,
    customFrom,
    customTo,
    selectedColumns,
    rowLimit,
    emptyValuesMode,
    placeholderText,
    format,
    csvDelimiter,
    csvEncoding,
    xlsxOneSheet,
    jsonShape,
    delivery,
  ]);

  const filterChips = useMemo(() => {
    const chips = filters.filter((f) => f.field && f.value).map((f) => `${f.field}: ${f.value}`);
    if (datePreset === "custom" && (customFrom || customTo)) {
      chips.push(`${customFrom || "…"} to ${customTo || "…"}`);
    } else if (datePreset !== "custom") {
      chips.push(
        datePreset === "7d"
          ? "Last 7 days"
          : datePreset === "90d"
            ? "Last 90 days"
            : "Last 30 days",
      );
    }
    return chips;
  }, [filters, datePreset, customFrom, customTo]);

  const canRun =
    Boolean(selectedKey) && selectedColumns.length > 0 && delivery !== "destination" && !runBusy;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingDefs(true);
      setError(null);
      try {
        const response = await fetchAllReportDefinitions();
        if (cancelled) return;
        const items = response.data.definitions.filter((d) => d.scope !== "tenant" || d.key);
        setDefinitions(items);
        const prefill = prefillKey && items.some((d) => d.key === prefillKey) ? prefillKey : null;
        if (prefill) {
          setSelectedKey(prefill);
          setReportCollapsed(true);
          setActiveSection("scope");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof ClientApiError
              ? loadError.message
              : loadError instanceof Error
                ? loadError.message
                : "Unable to load report definitions.",
          );
        }
      } finally {
        if (!cancelled) setLoadingDefs(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [prefillKey]);

  useEffect(() => {
    if (!selected) return;
    const cols = selected.columns ?? [];
    setSelectedColumns(cols);
    setDraftField(filterableParams[0]?.key ?? "");
    setFilters([]);
    setPreview(null);
    setPreviewOpen(false);
  }, [selectedKey]);

  useEffect(() => {
    if (!selectedKey || phase !== "configure") return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setPreviewBusy(true);
        try {
          const response = await previewExportBuilder({
            definitionKey: selectedKey,
            params: buildParams(),
            columns: selectedColumns,
            format,
            ...(rowLimit.trim() ? { rowLimit: Number(rowLimit) } : {}),
            sampleLimit: 10,
          });
          setPreview(response.data);
          if (selectedColumns.length === 0 && response.data.columns.length > 0) {
            setSelectedColumns(response.data.columns);
          }
        } catch {
          // Keep prior estimate; preview is best-effort while editing.
        } finally {
          setPreviewBusy(false);
        }
      })();
    }, 450);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    selectedKey,
    filters,
    datePreset,
    customFrom,
    customTo,
    selectedColumns,
    format,
    rowLimit,
    phase,
  ]);

  useEffect(() => {
    if (!runId || (phase !== "running" && phase !== "configure")) return;
    const activeRunId = runId;
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetchExportRunDetail(activeRunId, "report_run");
        if (cancelled) return;
        setRunDetail(response.data);
        if (response.data.status === "SUCCEEDED") setPhase("succeeded");
        if (response.data.status === "FAILED" || response.data.status === "CANCELLED") {
          setPhase("failed");
        }
      } catch {
        // Keep polling until cancelled.
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [runId, phase]);

  function selectReport(key: string) {
    setSelectedKey(key);
    setReportCollapsed(true);
    setActiveSection("scope");
  }

  function addFilter() {
    if (!draftField || !draftValue.trim()) return;
    setFilters((current) => [
      ...current,
      { id: newFilterId(), field: draftField, operator: draftOperator, value: draftValue.trim() },
    ]);
    setDraftValue("");
  }

  function toggleColumn(column: string) {
    setSelectedColumns((current) =>
      current.includes(column) ? current.filter((c) => c !== column) : [...current, column],
    );
  }

  async function handlePreviewSample() {
    if (!selectedKey) return;
    setPreviewBusy(true);
    setError(null);
    try {
      const response = await previewExportBuilder({
        definitionKey: selectedKey,
        params: buildParams(),
        columns: selectedColumns,
        format,
        sampleLimit: 10,
      });
      setPreview(response.data);
      setPreviewOpen(true);
    } catch (previewError) {
      setError(
        previewError instanceof ClientApiError
          ? previewError.message
          : previewError instanceof Error
            ? previewError.message
            : "Unable to preview rows.",
      );
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleRun() {
    if (!selectedKey || !canRun) return;
    setRunBusy(true);
    setError(null);
    try {
      if (scheduleEnabled) {
        await createReportSchedule({
          definitionKey: selectedKey,
          name: scheduleName.trim() || `${selected?.name ?? selectedKey} schedule`,
          cronExpression: scheduleCadence,
          timezone: scheduleTimezone,
          formats: [format],
          params: buildParams(),
          delivery: { kind: delivery === "email" ? "email" : "download_only" },
          isActive: true,
        });
      }

      const created = await startReportExportRun({
        definitionKey: selectedKey,
        format,
        params: buildParams(),
      });
      setRunId(created.data.id);
      setPhase("running");
      const detail = await fetchExportRunDetail(created.data.id, "report_run");
      setRunDetail(detail.data);
      if (detail.data.status === "SUCCEEDED") setPhase("succeeded");
      if (detail.data.status === "FAILED") setPhase("failed");
    } catch (runError) {
      setError(
        runError instanceof ClientApiError
          ? runError.message
          : runError instanceof Error
            ? runError.message
            : "Unable to start export.",
      );
      setPhase("failed");
    } finally {
      setRunBusy(false);
    }
  }

  async function handleScheduleOnly() {
    if (!selectedKey) return;
    setRunBusy(true);
    setError(null);
    try {
      await createReportSchedule({
        definitionKey: selectedKey,
        name: scheduleName.trim() || `${selected?.name ?? selectedKey} schedule`,
        cronExpression: scheduleCadence,
        timezone: scheduleTimezone,
        formats: [format],
        params: buildParams(),
        delivery: { kind: delivery === "email" ? "email" : "download_only" },
        isActive: true,
      });
      router.push("/admin/reports/exports");
    } catch (scheduleError) {
      setError(
        scheduleError instanceof ClientApiError
          ? scheduleError.message
          : scheduleError instanceof Error
            ? scheduleError.message
            : "Unable to save schedule.",
      );
    } finally {
      setRunBusy(false);
    }
  }

  async function handleCancelRun() {
    if (!runId) return;
    try {
      await cancelExportRun(runId, "report_run");
      const detail = await fetchExportRunDetail(runId, "report_run");
      setRunDetail(detail.data);
      setPhase("failed");
    } catch (cancelError) {
      setError(
        cancelError instanceof ClientApiError
          ? cancelError.message
          : cancelError instanceof Error
            ? cancelError.message
            : "Unable to cancel export.",
      );
    }
  }

  async function handleDownload() {
    if (!runDetail) return;
    const downloadFormat =
      runDetail.format === "xlsx" || runDetail.format === "pdf" || runDetail.format === "csv"
        ? runDetail.format
        : "csv";
    await downloadReportExport(runDetail.id, downloadFormat);
  }

  function resetToNew() {
    setPhase("configure");
    setRunId(null);
    setRunDetail(null);
    setError(null);
    setReportCollapsed(false);
    setActiveSection("report");
  }

  const sectionNav: Array<{ key: SectionKey; label: string }> = [
    { key: "report", label: "Selection" },
    { key: "scope", label: "Scope" },
    { key: "columns", label: "Columns" },
    { key: "format", label: "Format" },
    { key: "delivery", label: "Delivery" },
  ];

  if (phase === "running" && runDetail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <ModuleTabs active="new" />
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="flex w-full max-w-3xl flex-col items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center shadow-sm">
            <Loader2 className="mb-3 h-12 w-12 animate-spin text-[var(--admin-primary-strong)] motion-reduce:animate-none" />
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Exporting data
            </h1>
            <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
              Please wait while we prepare your export.
            </p>
            <div className="mt-8 w-full">
              <PipelineMini stages={runDetail.pipeline} />
            </div>
            <div className="mt-6 w-full max-w-md">
              <div className="mb-2 flex justify-between font-mono text-[13px]">
                <span className="text-[var(--admin-on-surface-variant)]">
                  {runDetail.rowCount != null
                    ? `${formatCount(runDetail.rowCount)} rows`
                    : "Working…"}
                  {" · "}
                  {runDetail.progressPercent == null
                    ? "…"
                    : `${String(runDetail.progressPercent)}%`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full rounded-full bg-[var(--admin-primary-strong)] transition-all duration-500"
                  style={{ width: `${String(runDetail.progressPercent ?? 8)}%` }}
                />
              </div>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                className="text-sm text-[var(--admin-danger)] hover:underline"
                onClick={() => void handleCancelRun()}
              >
                Cancel
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  router.push(`/admin/reports/exports/${runDetail.id}?source=report_run`);
                }}
              >
                Run in the background
              </button>
            </div>
          </div>
          <div className="mt-6 w-full max-w-md rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-left">
            <h3 className="mb-3 text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Parameters summary
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[var(--admin-on-surface-variant)]">Report</span>
                <span className="font-mono text-[var(--admin-on-surface)]">
                  {runDetail.definitionKey ?? runDetail.definitionTitle}
                </span>
              </div>
              <div className="h-px bg-[var(--admin-border)]" />
              <div className="flex justify-between gap-4">
                <span className="text-[var(--admin-on-surface-variant)]">Filters</span>
                <span className="text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {runDetail.filterChips[0] ?? "None"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "succeeded" && runDetail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <ModuleTabs active="new" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-xl flex-col items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center shadow-sm">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Export complete
            </h1>
            <span className="mt-3 inline-flex rounded border border-[color-mix(in_srgb,var(--admin-success)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-[var(--admin-success)] uppercase">
              Succeeded
            </span>
            <div className="mt-8 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6 text-left">
              <p className="mb-1 text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                File name
              </p>
              <p className="truncate font-mono text-[13px] text-[var(--admin-on-surface)]">
                {runDetail.fileName}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4">
                <div>
                  <p className="text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Size
                  </p>
                  <p className="font-mono text-[13px]">{runDetail.estimatedSizeLabel ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Rows
                  </p>
                  <p className="font-mono text-[13px]">
                    {runDetail.rowCount == null ? "-" : formatCount(runDetail.rowCount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => void handleDownload()}
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button type="button" className={secondaryButtonClassName} onClick={resetToNew}>
                New export
              </button>
              <Link
                href={`/admin/reports/exports/${runDetail.id}?source=report_run`}
                className={secondaryButtonClassName}
              >
                Open run
              </Link>
            </div>
            {runDetail.expiresAt ? (
              <p className="mt-6 flex items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                <Info className="h-4 w-4" />
                File will be removed after {runDetail.expiresAt.slice(0, 10)}.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <ModuleTabs active="new" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="absolute top-0 right-0 left-0 h-1 bg-[var(--admin-danger)]" />
            <div className="flex flex-col gap-6 p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[16px] font-semibold text-[var(--admin-on-surface)]">
                    Export failed
                  </h1>
                  <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                    Review the error details and try again.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-[var(--admin-danger)] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-danger)]" />
                  Failed
                </span>
              </div>
              <div className="flex gap-4 rounded-md border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
                <div>
                  <p className="font-mono text-[13px] font-semibold text-[var(--admin-danger)]">
                    {runDetail?.errorCode ?? "ExportFailed"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    {runDetail?.errorMessage ??
                      error ??
                      "The export failed before a file was produced."}
                  </p>
                  {runDetail?.failureHint ? (
                    <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                      {runDetail.failureHint}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-6">
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Run ID
                  </p>
                  <p className="font-mono text-[13px]">{runId ?? "-"}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Failure stage
                  </p>
                  <p className="font-mono text-[13px]">{runDetail?.failedStage ?? "-"}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-4">
              <button type="button" className={secondaryButtonClassName} onClick={resetToNew}>
                Retry with a narrower range
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={runBusy || !selectedKey}
                onClick={() => void handleRun()}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-28 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            New export
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Build an export against any report, then download or schedule it.
          </p>
        </div>
        <Link href="/admin/reports/exports" className={secondaryButtonClassName}>
          Cancel
        </Link>
      </div>

      <ModuleTabs active="new" />

      {error ? (
        <div
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex gap-8">
        <nav className="sticky top-24 hidden w-44 shrink-0 flex-col gap-1 self-start xl:flex">
          {sectionNav.map((item) => (
            <a
              key={item.key}
              href={`#section-${item.key}`}
              onClick={() => {
                setActiveSection(item.key);
              }}
              className={`flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors ${
                activeSection === item.key
                  ? "border-[var(--admin-primary-strong)] bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                  : "border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-8">
          <div className="flex min-w-0 max-w-[900px] flex-1 flex-col gap-10">
            {/* 1. Report */}
            <section id="section-report" className="scroll-mt-24">
              <SectionHeader
                step={1}
                title="Report"
                description="Choose which report this export should pull from."
              />
              {reportCollapsed && selected ? (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                        {selected.name}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {selected.key}
                      </span>
                      {PII_DEFINITION_KEYS.has(selected.key) ? (
                        <span className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-warning)]">
                          PII
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
                      {selected.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-[var(--admin-primary-strong)] hover:underline"
                    onClick={() => {
                      setReportCollapsed(false);
                      setActiveSection("report");
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-3 py-2">
                    <Search className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                    <input
                      className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-[var(--admin-on-surface-variant)]"
                      placeholder="Search reports…"
                      value={reportQuery}
                      onChange={(event) => {
                        setReportQuery(event.target.value);
                      }}
                    />
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {loadingDefs ? (
                      <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
                        Loading definitions…
                      </p>
                    ) : groupedDefinitions.length === 0 ? (
                      <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
                        No reports match your search.
                      </p>
                    ) : (
                      groupedDefinitions.map((group) => (
                        <div key={group.theme}>
                          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                            {group.theme}
                          </div>
                          {group.items.map((definition) => {
                            const active = definition.key === selectedKey;
                            return (
                              <button
                                key={definition.id}
                                type="button"
                                className={`flex w-full items-center gap-3 border-b border-[var(--admin-border)] border-l-2 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)] ${
                                  active
                                    ? "border-l-[var(--admin-primary-strong)] bg-[var(--admin-primary-container)]"
                                    : "border-l-transparent"
                                }`}
                                onClick={() => {
                                  selectReport(definition.key);
                                }}
                              >
                                <span className="w-[28%] shrink-0 text-sm font-medium text-[var(--admin-on-surface)]">
                                  {definition.name}
                                </span>
                                <span className="w-[22%] shrink-0 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                                  {definition.key}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
                                  {definition.description || "No description"}
                                </span>
                                {PII_DEFINITION_KEYS.has(definition.key) ? (
                                  <span className="shrink-0 rounded border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-warning)]">
                                    PII
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 2. Scope */}
            <section id="section-scope" className="scroll-mt-24">
              <SectionHeader
                step={2}
                title="Scope"
                description="Narrow the export with filters, a date range, and an optional row limit."
              />
              <div className="flex flex-col gap-5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
                {!selected ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    Select a report first.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <label className="text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                        Filters
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <div className="min-w-[150px] flex-1">
                          <DropdownField
                            label={<span className="sr-only">Field</span>}
                            labelId={fieldLabelId}
                            open={fieldOpen}
                            onToggle={() => {
                              setFieldOpen((o) => !o);
                            }}
                            triggerContent={
                              <span className="flex w-full items-center justify-between gap-2">
                                <span>
                                  {filterableParams.find((p) => p.key === draftField)?.label ??
                                    "Field"}
                                </span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform duration-200 ${fieldOpen ? "rotate-180" : ""}`}
                                />
                              </span>
                            }
                          >
                            <div className="max-h-56 overflow-y-auto p-1" role="listbox">
                              {filterableParams.map((param) => (
                                <button
                                  key={param.key}
                                  type="button"
                                  role="option"
                                  className={dropdownItemClassName}
                                  onClick={() => {
                                    setDraftField(param.key);
                                    setFieldOpen(false);
                                  }}
                                >
                                  {param.label}
                                </button>
                              ))}
                            </div>
                          </DropdownField>
                        </div>
                        <div className="min-w-[120px]">
                          <DropdownField
                            label={<span className="sr-only">Operator</span>}
                            labelId={operatorLabelId}
                            open={operatorOpen}
                            onToggle={() => {
                              setOperatorOpen((o) => !o);
                            }}
                            triggerContent={
                              <span className="flex w-full items-center justify-between gap-2">
                                <span>{draftOperator === "eq" ? "is equal to" : "contains"}</span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform duration-200 ${operatorOpen ? "rotate-180" : ""}`}
                                />
                              </span>
                            }
                          >
                            <div className="p-1" role="listbox">
                              {(
                                [
                                  ["eq", "is equal to"],
                                  ["contains", "contains"],
                                ] as const
                              ).map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  role="option"
                                  className={dropdownItemClassName}
                                  onClick={() => {
                                    setDraftOperator(value);
                                    setOperatorOpen(false);
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </DropdownField>
                        </div>
                        <input
                          className={`${fieldClassName} min-w-[140px] flex-1`}
                          value={draftValue}
                          onChange={(event) => {
                            setDraftValue(event.target.value);
                          }}
                          placeholder="Value"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addFilter();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={addFilter}
                          aria-label="Add filter"
                        >
                          Add
                        </button>
                      </div>
                      {filters.length > 0 ? (
                        <div className={`flex flex-wrap gap-2 ${inlineExpandClassName}`}>
                          {filters.map((filter) => (
                            <span
                              key={filter.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1 text-[12px]"
                            >
                              <span className="text-[var(--admin-on-surface-variant)]">
                                {filter.field}:
                              </span>
                              <span className="font-medium text-[var(--admin-on-surface)]">
                                {filter.value}
                              </span>
                              <button
                                type="button"
                                className="rounded-full p-0.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                                aria-label={`Remove ${filter.field} filter`}
                                onClick={() => {
                                  setFilters((current) =>
                                    current.filter((f) => f.id !== filter.id),
                                  );
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className="text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                          Date range
                        </label>
                        <DropdownField
                          label={<span className="sr-only">Date range</span>}
                          labelId={dateLabelId}
                          open={datePresetOpen}
                          onToggle={() => {
                            setDatePresetOpen((o) => !o);
                          }}
                          leftIcon={<Calendar className="h-4 w-4" />}
                          triggerContent={
                            <span className="flex w-full items-center justify-between gap-2">
                              <span>
                                {datePreset === "7d"
                                  ? "Last 7 days"
                                  : datePreset === "90d"
                                    ? "Last 90 days"
                                    : datePreset === "custom"
                                      ? "Custom"
                                      : "Last 30 days"}
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${datePresetOpen ? "rotate-180" : ""}`}
                              />
                            </span>
                          }
                        >
                          <div className="p-1" role="listbox">
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
                                className={dropdownItemClassName}
                                onClick={() => {
                                  setDatePreset(value);
                                  setDatePresetOpen(false);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </DropdownField>
                        {datePreset === "custom" ? (
                          <div className={`mt-2 grid grid-cols-2 gap-2 ${inlineExpandClassName}`}>
                            <input
                              type="date"
                              className={fieldClassName}
                              value={customFrom}
                              onChange={(event) => {
                                setCustomFrom(event.target.value);
                              }}
                            />
                            <input
                              type="date"
                              className={fieldClassName}
                              value={customTo}
                              onChange={(event) => {
                                setCustomTo(event.target.value);
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                          Row limit
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          className={fieldClassName}
                          placeholder="No limit (max 10,000)"
                          value={rowLimit}
                          onChange={(event) => {
                            setRowLimit(event.target.value);
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
                      <p className="flex items-center gap-1.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                        {previewBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                        ) : (
                          <Check className="h-4 w-4 text-[var(--admin-success)]" />
                        )}
                        {preview
                          ? `About ${formatCount(preview.estimatedRowCount)} rows match current filters${preview.capped ? " (capped)" : ""}`
                          : "Estimating matching rows…"}
                      </p>
                      <button
                        type="button"
                        className={secondaryButtonClassName}
                        disabled={previewBusy}
                        onClick={() => void handlePreviewSample()}
                      >
                        Preview 10 rows
                      </button>
                    </div>

                    {previewOpen && preview ? (
                      <div
                        className={`overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] ${inlineExpandClassName}`}
                      >
                        <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
                          <thead>
                            <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                              {preview.columns.slice(0, 6).map((column) => (
                                <th
                                  key={column}
                                  className="px-3 py-2 font-mono font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase"
                                >
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.sampleRows.map((row, index) => (
                              <tr
                                key={index}
                                className="border-b border-[var(--admin-border)] last:border-b-0"
                              >
                                {preview.columns.slice(0, 6).map((column) => (
                                  <td
                                    key={column}
                                    className="max-w-[160px] truncate px-3 py-2 font-mono text-[var(--admin-on-surface)]"
                                  >
                                    {row[column] == null
                                      ? "-"
                                      : typeof row[column] === "string" ||
                                          typeof row[column] === "number" ||
                                          typeof row[column] === "boolean"
                                        ? String(row[column])
                                        : JSON.stringify(row[column])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </section>

            {/* 3. Columns */}
            <section id="section-columns" className="scroll-mt-24">
              <SectionHeader
                step={3}
                title="Columns"
                description="Pick which fields appear in the file, and how empty values are written."
              />
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                {!selected ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    Select a report first.
                  </p>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        {selectedColumns.length} of {availableColumns.length || "…"} columns
                        selected
                      </p>
                      <button
                        type="button"
                        className="text-sm font-medium text-[var(--admin-primary-strong)] hover:underline"
                        onClick={() => {
                          setSelectedColumns(availableColumns);
                        }}
                      >
                        Select all
                      </button>
                    </div>
                    {piiColumns.length > 0 ? (
                      <p className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)] px-3 py-2 text-[12px] text-[var(--admin-warning)]">
                        {piiColumns.slice(0, 4).join(", ")}
                        {piiColumns.length > 4 ? ", and more" : ""} are personal data.
                      </p>
                    ) : null}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(availableColumns.length > 0 ? availableColumns : ["Loading…"]).map(
                        (column) => {
                          const checked = selectedColumns.includes(column);
                          const pii = isPiiColumn(column);
                          return (
                            <label
                              key={column}
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 hover:bg-[var(--admin-surface-low)]"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)]"
                                checked={checked}
                                disabled={availableColumns.length === 0}
                                onChange={() => {
                                  toggleColumn(column);
                                }}
                              />
                              <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {column}
                              </span>
                              {pii ? (
                                <span className="ml-auto font-mono text-[10px] text-[var(--admin-warning)]">
                                  PII
                                </span>
                              ) : null}
                            </label>
                          );
                        },
                      )}
                    </div>
                    <div className="mt-5 border-t border-[var(--admin-border)] pt-4">
                      <p className="mb-2 text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                        Empty values
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {(
                          [
                            ["blank", "Leave blank"],
                            ["placeholder", "Write a placeholder"],
                          ] as const
                        ).map(([value, label]) => (
                          <label key={value} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="empty-values"
                              checked={emptyValuesMode === value}
                              onChange={() => {
                                setEmptyValuesMode(value);
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      {emptyValuesMode === "placeholder" ? (
                        <input
                          className={`${fieldClassName} mt-2 max-w-xs ${inlineExpandClassName}`}
                          value={placeholderText}
                          onChange={(event) => {
                            setPlaceholderText(event.target.value);
                          }}
                          placeholder="Placeholder text"
                        />
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* 4. Format */}
            <section id="section-format" className="scroll-mt-24">
              <SectionHeader
                step={4}
                title="Format"
                description="Choose the file type and format-specific options."
              />
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
                  {(
                    [
                      ["csv", "CSV", "CSV for spreadsheets and imports"],
                      ["xlsx", "XLSX", "XLSX keeps column types and formatting"],
                      ["json", "JSON", "JSON for pipelines"],
                    ] as const
                  ).map(([value, label, caption]) => (
                    <button
                      key={value}
                      type="button"
                      title={caption}
                      className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                        format === value
                          ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                          : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      }`}
                      onClick={() => {
                        setFormat(value);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
                  {format === "csv"
                    ? "CSV for spreadsheets and imports"
                    : format === "xlsx"
                      ? "XLSX keeps column types and formatting"
                      : "JSON for pipelines"}
                </p>
                {format === "csv" ? (
                  <div className={`mt-4 grid grid-cols-2 gap-3 ${inlineExpandClassName}`}>
                    <div>
                      <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                        Delimiter
                      </label>
                      <input
                        className={fieldClassName}
                        value={csvDelimiter}
                        onChange={(event) => {
                          setCsvDelimiter(event.target.value.slice(0, 1) || ",");
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                        Encoding
                      </label>
                      <input
                        className={fieldClassName}
                        value={csvEncoding}
                        onChange={(event) => {
                          setCsvEncoding(event.target.value);
                        }}
                      />
                    </div>
                  </div>
                ) : null}
                {format === "xlsx" ? (
                  <label
                    className={`mt-4 flex items-center gap-2 text-sm ${inlineExpandClassName}`}
                  >
                    <input
                      type="checkbox"
                      checked={xlsxOneSheet}
                      onChange={(event) => {
                        setXlsxOneSheet(event.target.checked);
                      }}
                    />
                    One sheet per group
                  </label>
                ) : null}
                {format === "json" ? (
                  <div className={`mt-4 flex flex-wrap gap-4 ${inlineExpandClassName}`}>
                    {(
                      [
                        ["flat", "Flat"],
                        ["nested", "Nested"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="json-shape"
                          checked={jsonShape === value}
                          onChange={() => {
                            setJsonShape(value);
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            {/* 5. Delivery */}
            <section id="section-delivery" className="scroll-mt-24">
              <SectionHeader
                step={5}
                title="Delivery"
                description="Download when ready, email a link, or schedule a recurring run."
              />
              <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                {(
                  [
                    ["download", "Download when ready"],
                    ["email", "Email me when ready"],
                    ["destination", "Send to a destination (coming soon)"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                      delivery === value
                        ? "border-[var(--admin-primary-strong)] bg-[var(--admin-primary-container)]"
                        : "border-[var(--admin-border)]"
                    } ${value === "destination" ? "opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={delivery === value}
                      disabled={value === "destination"}
                      onChange={() => {
                        setDelivery(value);
                      }}
                    />
                    {label}
                  </label>
                ))}

                <div className="border-t border-[var(--admin-border)] pt-4">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Schedule this export</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={scheduleEnabled}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        scheduleEnabled ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]"
                      }`}
                      onClick={() => {
                        setScheduleEnabled((current) => !current);
                      }}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow transition-transform ${
                          scheduleEnabled ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                  </label>
                  {scheduleEnabled ? (
                    <div
                      className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 ${inlineExpandClassName}`}
                    >
                      <div>
                        <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                          Cadence
                        </label>
                        <DropdownField
                          label={<span className="sr-only">Cadence</span>}
                          labelId={cadenceLabelId}
                          open={scheduleCadenceOpen}
                          onToggle={() => {
                            setScheduleCadenceOpen((o) => !o);
                          }}
                          triggerContent={
                            <span className="flex w-full items-center justify-between gap-2 capitalize">
                              {scheduleCadence}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${scheduleCadenceOpen ? "rotate-180" : ""}`}
                              />
                            </span>
                          }
                        >
                          <div className="p-1" role="listbox">
                            {["hourly", "daily", "weekly", "monthly"].map((value) => (
                              <button
                                key={value}
                                type="button"
                                role="option"
                                className={`${dropdownItemClassName} capitalize`}
                                onClick={() => {
                                  setScheduleCadence(value);
                                  setScheduleCadenceOpen(false);
                                }}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </DropdownField>
                      </div>
                      <div>
                        <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                          Timezone
                        </label>
                        <input
                          className={fieldClassName}
                          value={scheduleTimezone}
                          onChange={(event) => {
                            setScheduleTimezone(event.target.value);
                          }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                          Name this schedule
                        </label>
                        <input
                          className={fieldClassName}
                          value={scheduleName}
                          onChange={(event) => {
                            setScheduleName(event.target.value);
                          }}
                          placeholder={selected ? `${selected.name} schedule` : "Schedule name"}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          {/* Sticky summary rail */}
          <aside className="hidden w-[300px] shrink-0 lg:block">
            <div className="sticky top-24 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
                <h3 className="text-[16px] font-bold text-[var(--admin-on-surface)]">
                  Configuration summary
                </h3>
              </div>
              <div className="flex flex-col gap-4 p-5">
                <div className="border-b border-[var(--admin-border)] pb-3">
                  <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Report
                  </p>
                  <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                    {selected?.name ?? "Not selected"}
                  </p>
                  {selected ? (
                    <p className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                      {selected.key}
                    </p>
                  ) : null}
                </div>
                <div className="border-b border-[var(--admin-border)] pb-3">
                  <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Filters
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {filterChips.length === 0 ? (
                      <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                        None
                      </span>
                    ) : (
                      filterChips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]"
                        >
                          {chip}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Columns
                  </span>
                  <span className="font-mono text-[13px]">
                    {selectedColumns.length}/{availableColumns.length || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Format
                  </span>
                  <span className="font-mono text-[13px] uppercase">{format}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Delivery
                  </span>
                  <span className="text-[13px] capitalize">{delivery}</span>
                </div>
                <div className="flex items-center justify-between pb-1">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Estimate
                  </span>
                  <span className="font-mono text-[13px]">
                    {preview
                      ? `${formatCount(preview.estimatedRowCount)} · ${preview.estimatedSizeLabel ?? "-"}`
                      : "-"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                  Files are removed after 7 days.
                </p>
              </div>
              <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
                <button
                  type="button"
                  className={`${primaryButtonClassName} w-full`}
                  disabled={!canRun}
                  onClick={() => void handleRun()}
                >
                  {runBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {runBusy ? "Starting…" : "Run export"}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full text-center text-sm font-medium text-[var(--admin-primary-strong)] hover:underline disabled:opacity-40"
                  disabled={!selectedKey || runBusy}
                  onClick={() => {
                    setScheduleEnabled(true);
                    void handleScheduleOnly();
                  }}
                >
                  Save as a schedule only
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3">
          <div className="min-w-0 flex-1 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
            {preview ? formatCount(preview.estimatedRowCount) : "-"} rows · {format.toUpperCase()} ·{" "}
            {delivery}
          </div>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={!canRun}
            onClick={() => void handleRun()}
          >
            {runBusy ? "…" : "Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
