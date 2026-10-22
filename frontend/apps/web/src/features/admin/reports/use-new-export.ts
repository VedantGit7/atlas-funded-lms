"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientApiError } from "../../../lib/client-api";
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
  mapDefinition,
  type ReportDefinition,
} from "./admin-reports-api";
import {
  ENABLED_DESTINATIONS_FILTERS,
  fetchDestinationsRoster,
  type DestinationItem,
} from "./admin-export-destinations-api";
import { useReportLoad } from "./use-report-load";
import {
  type DatePreset,
  type DeliveryMode,
  type EmptyValuesMode,
  type FilterRow,
  type FormatOption,
  type NewExportPageProps,
  type Phase,
  type SectionKey,
  THEME_ORDER,
  builderDefinitions,
  dateParamKeys,
  datePresetRange,
  filterableParamsOf,
  isPiiColumn,
  newFilterId,
  themeFor,
} from "./admin-new-export-shared";

/** The state, data loading and handlers behind AdminNewExportPage. */
export function useNewExport(props: NewExportPageProps) {
  const { initialDefinitions, initialDestinations } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillKey = searchParams.get("definition") ?? searchParams.get("report");

  // Read once: later renders must not reset what the page has changed since.
  const [initialDefs] = useState(() => initialDefinitions ?? null);
  const [initialDests] = useState(() => initialDestinations ?? null);
  // With the server's definitions, the report the address names starts
  // selected, as the browser load selects it once it arrives.
  const [boot] = useState(() => {
    const items = initialDefs ? builderDefinitions(initialDefs.data.items.map(mapDefinition)) : [];
    const prefill = prefillKey && items.some((d) => d.key === prefillKey) ? prefillKey : null;
    return { items, prefill, chosen: items.find((d) => d.key === prefill) ?? null };
  });

  const [phase, setPhase] = useState<Phase>("configure");
  const [definitions, setDefinitions] = useState<ReportDefinition[]>(boot.items);
  const [loadingDefs, setLoadingDefs] = useState(initialDefs === null);
  const [error, setError] = useState<string | null>(null);

  const [reportQuery, setReportQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(boot.prefill);
  const [reportCollapsed, setReportCollapsed] = useState(boot.prefill !== null);

  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [draftField, setDraftField] = useState(() => filterableParamsOf(boot.chosen)[0]?.key ?? "");
  const [draftOperator, setDraftOperator] = useState<"eq" | "contains">("eq");
  const [draftValue, setDraftValue] = useState("");
  const [fieldOpen, setFieldOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [datePresetOpen, setDatePresetOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rowLimit, setRowLimit] = useState("");

  const [selectedColumns, setSelectedColumns] = useState<string[]>(boot.chosen?.columns ?? []);
  const [emptyValuesMode, setEmptyValuesMode] = useState<EmptyValuesMode>("blank");
  const [placeholderText, setPlaceholderText] = useState("-");

  const [format, setFormat] = useState<FormatOption>("csv");
  const [csvDelimiter, setCsvDelimiter] = useState(",");
  const [csvEncoding, setCsvEncoding] = useState("utf-8");
  const [xlsxOneSheet, setXlsxOneSheet] = useState(false);
  const [jsonShape, setJsonShape] = useState<"flat" | "nested">("flat");

  const [delivery, setDelivery] = useState<DeliveryMode>("download");
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("");
  const [destinations, setDestinations] = useState<DestinationItem[]>(
    () => initialDests?.data.items.filter((item) => item.isActive) ?? [],
  );
  const [destinationsLoading, setDestinationsLoading] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCadence, setScheduleCadence] = useState("daily");
  const [scheduleCadenceOpen, setScheduleCadenceOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("UTC");

  const [preview, setPreview] = useState<ExportBuilderPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>(boot.prefill ? "scope" : "report");

  const [runDetail, setRunDetail] = useState<ExportRunDetail | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const fieldLabelId = useId();
  const operatorLabelId = useId();
  const dateLabelId = useId();
  const cadenceLabelId = useId();
  const destinationLabelId = useId();

  const selected = useMemo(
    () => definitions.find((d) => d.key === selectedKey) ?? null,
    [definitions, selectedKey],
  );

  const filterableParams = useMemo(() => filterableParamsOf(selected), [selected]);

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
    const selectedDest =
      delivery === "destination"
        ? destinations.find((item) => item.id === selectedDestinationId)
        : null;
    params["delivery"] = {
      kind:
        delivery === "email"
          ? "email"
          : delivery === "destination"
            ? (selectedDest?.kind ?? "storage")
            : "download_only",
      ...(delivery === "destination" && selectedDestinationId
        ? { destinationId: selectedDestinationId }
        : {}),
    };
    if (delivery === "destination" && selectedDestinationId) {
      params["destinationId"] = selectedDestinationId;
      params["deliveryMode"] = "destination";
    } else if (delivery === "email") {
      params["deliveryMode"] = "email_me";
    }
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
    selectedDestinationId,
    destinations,
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
    Boolean(selectedKey) &&
    selectedColumns.length > 0 &&
    (delivery !== "destination" || Boolean(selectedDestinationId)) &&
    !runBusy;

  const selectedDestination = useMemo(
    () => destinations.find((item) => item.id === selectedDestinationId) ?? null,
    [destinations, selectedDestinationId],
  );

  // A newer load, or leaving the page, cancels the one in flight.
  const definitionsRequest = useRef<AbortController | null>(null);

  const loadDefinitions = useCallback(
    async (options?: { soft?: boolean }) => {
      definitionsRequest.current?.abort();
      const request = new AbortController();
      definitionsRequest.current = request;
      const soft = options?.soft === true;
      if (!soft) setLoadingDefs(true);
      setError(null);
      try {
        const response = await fetchAllReportDefinitions();
        if (request.signal.aborted) return;
        const items = builderDefinitions(response.data.definitions);
        setDefinitions(items);
        const prefill = prefillKey && items.some((d) => d.key === prefillKey) ? prefillKey : null;
        if (prefill) {
          setSelectedKey(prefill);
          setReportCollapsed(true);
          setActiveSection("scope");
        }
      } catch (loadError) {
        if (!request.signal.aborted) {
          setError(
            loadError instanceof ClientApiError
              ? loadError.message
              : loadError instanceof Error
                ? loadError.message
                : "Unable to load report definitions.",
          );
        }
      } finally {
        if (!request.signal.aborted && !soft) setLoadingDefs(false);
      }
    },
    [prefillKey],
  );

  useReportLoad(loadDefinitions, initialDefs);

  const destinationsRequest = useRef<AbortController | null>(null);

  const loadDestinations = useCallback(async (options?: { soft?: boolean }) => {
    destinationsRequest.current?.abort();
    const request = new AbortController();
    destinationsRequest.current = request;
    const soft = options?.soft === true;
    if (!soft) setDestinationsLoading(true);
    try {
      const response = await fetchDestinationsRoster(ENABLED_DESTINATIONS_FILTERS);
      if (request.signal.aborted) return;
      setDestinations(response.data.items.filter((item) => item.isActive));
    } catch {
      if (!request.signal.aborted) setDestinations([]);
    } finally {
      if (!request.signal.aborted && !soft) setDestinationsLoading(false);
    }
  }, []);

  useReportLoad(loadDestinations, initialDests);

  useEffect(
    () => () => {
      definitionsRequest.current?.abort();
      destinationsRequest.current?.abort();
    },
    [],
  );

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

  function buildDeliveryPayload(): Record<string, unknown> {
    if (delivery === "destination" && selectedDestinationId) {
      const dest = destinations.find((item) => item.id === selectedDestinationId);
      return {
        kind: dest?.kind ?? "storage",
        destinationId: selectedDestinationId,
        mode: "destination",
      };
    }
    if (delivery === "email") {
      return { kind: "email", mode: "email_me" };
    }
    return { kind: "download_only" };
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
          delivery: buildDeliveryPayload(),
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
    if (delivery === "destination" && !selectedDestinationId) {
      setError("Select a destination before scheduling.");
      return;
    }
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
        delivery: buildDeliveryPayload(),
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

  return {
    router,
    phase,
    loadingDefs,
    error,
    reportQuery,
    setReportQuery,
    selectedKey,
    reportCollapsed,
    setReportCollapsed,
    filters,
    setFilters,
    draftField,
    setDraftField,
    draftOperator,
    setDraftOperator,
    draftValue,
    setDraftValue,
    fieldOpen,
    setFieldOpen,
    operatorOpen,
    setOperatorOpen,
    datePreset,
    setDatePreset,
    datePresetOpen,
    setDatePresetOpen,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    rowLimit,
    setRowLimit,
    selectedColumns,
    setSelectedColumns,
    emptyValuesMode,
    setEmptyValuesMode,
    placeholderText,
    setPlaceholderText,
    format,
    setFormat,
    csvDelimiter,
    setCsvDelimiter,
    csvEncoding,
    setCsvEncoding,
    xlsxOneSheet,
    setXlsxOneSheet,
    jsonShape,
    setJsonShape,
    delivery,
    setDelivery,
    setSelectedDestinationId,
    destinations,
    destinationsLoading,
    destinationOpen,
    setDestinationOpen,
    scheduleEnabled,
    setScheduleEnabled,
    scheduleCadence,
    setScheduleCadence,
    scheduleCadenceOpen,
    setScheduleCadenceOpen,
    scheduleName,
    setScheduleName,
    scheduleTimezone,
    setScheduleTimezone,
    preview,
    previewBusy,
    previewOpen,
    runBusy,
    activeSection,
    setActiveSection,
    runDetail,
    runId,
    fieldLabelId,
    operatorLabelId,
    dateLabelId,
    cadenceLabelId,
    destinationLabelId,
    selected,
    filterableParams,
    availableColumns,
    piiColumns,
    groupedDefinitions,
    filterChips,
    canRun,
    selectedDestination,
    selectReport,
    addFilter,
    toggleColumn,
    handlePreviewSample,
    handleRun,
    handleScheduleOnly,
    handleCancelRun,
    handleDownload,
    resetToNew,
    sectionNav,
  };
}

export type NewExportView = ReturnType<typeof useNewExport>;
