"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyticsAlertErrorClassName,
  analyticsExportButtonClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { VisualizationPanel } from "../../analytics/viz";
import type { NormalizedResult, VizType } from "../../analytics/viz";
import { BiExportPanel } from "./BiExportPanel";
import { CustomReportBuilder } from "./CustomReportBuilder";
import {
  createReportSchedule,
  downloadReportExport,
  fetchReportDefinitions,
  fetchReportHistory,
  fetchReportPreview,
  fetchReportSchedules,
  pollReportRunUntilComplete,
  startReportRun,
  type ReportDefinition,
  type ReportHistoryItem,
  type ReportSchedule,
} from "./admin-reports-api";
import { REPORT_MANAGE_LINKS, SCHEDULE_CADENCE_OPTIONS } from "./admin-report-section-shared";
import type { AdminReportSlug } from "./admin-reports-catalog";

type AdminReportSectionPageProps = {
  slug: string;
  title: string;
};

type ParamState = Record<string, string>;

function buildInitialParams(definition: ReportDefinition | null): ParamState {
  if (!definition) return {};
  return Object.fromEntries(
    definition.params.map((param) => [param.key, param.defaultValue ?? ""]),
  );
}

export function AdminReportSectionPage({ slug, title }: AdminReportSectionPageProps) {
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>("");
  const [params, setParams] = useState<ParamState>({});
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [preview, setPreview] = useState<NormalizedResult | null>(null);
  const [defaultViz, setDefaultViz] = useState<VizType>("table");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [loadingDefinitions, setLoadingDefinitions] = useState(true);
  const [running, setRunning] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleCadence, setScheduleCadence] = useState<string>(SCHEDULE_CADENCE_OPTIONS[1].value);
  const [scheduleFormats, setScheduleFormats] = useState<Array<"csv" | "xlsx" | "pdf">>(["csv"]);
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  const manageLink = REPORT_MANAGE_LINKS[slug as AdminReportSlug];

  const selectedDefinition = useMemo(
    () => definitions.find((definition) => definition.key === selectedDefinitionId) ?? null,
    [definitions, selectedDefinitionId],
  );

  const loadCatalog = useCallback(async () => {
    setLoadingDefinitions(true);
    setError(null);
    try {
      const definitionsResponse = await fetchReportDefinitions(slug);
      setDefinitions(definitionsResponse.data.definitions);

      const first = definitionsResponse.data.definitions[0];
      if (first) {
        setSelectedDefinitionId(first.key);
        setParams(buildInitialParams(first));
        setDefaultViz(first.defaultViz);
      }

      const [schedulesResult, historyResult] = await Promise.allSettled([
        fetchReportSchedules(slug),
        fetchReportHistory(slug),
      ]);

      if (schedulesResult.status === "fulfilled") {
        setSchedules(schedulesResult.value.data.schedules);
      } else {
        setSchedules([]);
      }

      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value.data.items);
      } else {
        setHistory([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
      setDefinitions([]);
      setSchedules([]);
      setHistory([]);
    } finally {
      setLoadingDefinitions(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    setParams(buildInitialParams(selectedDefinition));
    if (selectedDefinition) {
      setDefaultViz(selectedDefinition.defaultViz);
    }
  }, [selectedDefinition]);

  async function handleRunReport() {
    if (!selectedDefinition) return;

    setRunning(true);
    setError(null);
    setPreview(null);
    setActiveRunId(null);

    try {
      const runResponse = await startReportRun(selectedDefinition.key, params);
      setActiveRunId(runResponse.data.id);

      setLoadingPreview(true);
      const previewResponse = await fetchReportPreview(runResponse.data.id);
      setPreview(previewResponse.data.preview);
      setDefaultViz(previewResponse.data.defaultViz);

      void pollReportRunUntilComplete(runResponse.data.id).then(async () => {
        const historyResponse = await fetchReportHistory(slug);
        setHistory(historyResponse.data.items);
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run report.");
    } finally {
      setRunning(false);
      setLoadingPreview(false);
    }
  }

  async function handleCreateSchedule(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!selectedDefinition) return;

    setCreatingSchedule(true);
    setError(null);
    try {
      await createReportSchedule({
        definitionKey: selectedDefinition.key,
        name: scheduleName.trim() || selectedDefinition.name,
        cronExpression: scheduleCadence,
        formats: scheduleFormats,
        isActive: true,
      });
      setScheduleName("");
      const schedulesResponse = await fetchReportSchedules(slug);
      setSchedules(schedulesResponse.data.schedules);
    } catch (scheduleError) {
      setError(
        scheduleError instanceof Error ? scheduleError.message : "Unable to create schedule.",
      );
    } finally {
      setCreatingSchedule(false);
    }
  }

  function toggleScheduleFormat(format: "csv" | "xlsx" | "pdf") {
    setScheduleFormats((current) =>
      current.includes(format) ? current.filter((value) => value !== format) : [...current, format],
    );
  }

  const paramFilters = selectedDefinition ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {selectedDefinition.params.map((param) => (
        <label key={param.key} className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
            {param.label}
            {param.required ? " *" : ""}
          </span>
          {param.type === "select" ? (
            <select
              className={fieldClassName}
              value={params[param.key] ?? ""}
              onChange={(event) => {
                setParams((current) => ({ ...current, [param.key]: event.target.value }));
              }}
            >
              <option value="">All</option>
              {param.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={param.type === "date" ? "date" : "text"}
              className={fieldClassName}
              value={params[param.key] ?? ""}
              onChange={(event) => {
                setParams((current) => ({ ...current, [param.key]: event.target.value }));
              }}
            />
          )}
        </label>
      ))}
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className={generalSettingsPageTitleClassName}>{title}</h1>
        <p className={generalSettingsPageDescClassName}>
          Run academy reports, preview results, and download exports for {title.toLowerCase()}.
        </p>
        {manageLink ? (
          <p className="mt-3">
            <Link
              href={manageLink.href}
              className="inline-flex items-center rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-surface-low)]"
            >
              {manageLink.label}
            </Link>
          </p>
        ) : null}
      </header>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      <div className={generalSettingsFormCardClassName}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="block min-w-[240px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Report
            </span>
            <select
              className={fieldClassName}
              disabled={loadingDefinitions || definitions.length === 0}
              value={selectedDefinitionId}
              onChange={(event) => {
                setSelectedDefinitionId(event.target.value);
              }}
            >
              {definitions.map((definition) => (
                <option key={definition.key} value={definition.key}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={loadingDefinitions}
              onClick={() => void loadCatalog()}
            >
              Refresh
            </button>
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={!selectedDefinition || running}
              onClick={() => void handleRunReport()}
            >
              {running ? "Running…" : "Run report"}
            </button>
          </div>
        </div>

        {selectedDefinition ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">
            {selectedDefinition.description}
          </p>
        ) : null}

        {paramFilters ? <div className="mt-6">{paramFilters}</div> : null}
      </div>

      {slug === "exports" ? (
        <>
          <CustomReportBuilder
            onRunStarted={(runId) => {
              setActiveRunId(runId);
              void loadCatalog();
            }}
          />
          <BiExportPanel />
        </>
      ) : null}

      {preview || loadingPreview || running ? (
        <VisualizationPanel
          preferenceKey={`report:${slug}:${selectedDefinitionId}`}
          title="Preview"
          data={preview ?? { columns: [], rows: [] }}
          defaultViz={defaultViz}
          loading={running || loadingPreview}
          filters={paramFilters}
        />
      ) : null}

      {activeRunId ? (
        <div className="flex flex-wrap gap-2">
          {(["csv", "xlsx", "pdf"] as const).map((format) => (
            <button
              key={format}
              type="button"
              className={analyticsExportButtonClassName}
              onClick={() => void downloadReportExport(activeRunId, format)}
            >
              Download {format.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}

      <section
        className={generalSettingsFormCardClassName}
        aria-labelledby="report-schedules-heading"
      >
        <h2
          id="report-schedules-heading"
          className="text-lg font-semibold text-[var(--admin-on-surface)]"
        >
          Schedules
        </h2>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => void handleCreateSchedule(event)}
        >
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Name
            </span>
            <input
              className={fieldClassName}
              value={scheduleName}
              onChange={(event) => {
                setScheduleName(event.target.value);
              }}
              placeholder={selectedDefinition?.name ?? "Schedule name"}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Cadence
            </span>
            <select
              className={fieldClassName}
              value={scheduleCadence}
              onChange={(event) => {
                setScheduleCadence(event.target.value);
              }}
            >
              {SCHEDULE_CADENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Formats
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {(["csv", "xlsx", "pdf"] as const).map((format) => (
                <label key={format} className="inline-flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={scheduleFormats.includes(format)}
                    onChange={() => {
                      toggleScheduleFormat(format);
                    }}
                  />
                  {format.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className={primaryButtonClassName}
              disabled={!selectedDefinition || creatingSchedule || scheduleFormats.length === 0}
            >
              {creatingSchedule ? "Creating…" : "Create schedule"}
            </button>
          </div>
        </form>

        {schedules.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">
            No schedules configured yet.
          </p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Name</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Cadence</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Next run</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Formats</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3">{schedule.name}</td>
                    <td className="px-4 py-3 capitalize">{schedule.cadence}</td>
                    <td className="px-4 py-3">{new Date(schedule.nextRunAt).toLocaleString()}</td>
                    <td className="px-4 py-3 uppercase">{schedule.formats.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className={generalSettingsFormCardClassName}
        aria-labelledby="report-history-heading"
      >
        <h2
          id="report-history-heading"
          className="text-lg font-semibold text-[var(--admin-on-surface)]"
        >
          Run history
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">No runs yet.</p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Report</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Status</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Started</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Completed</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3">{item.definitionName}</td>
                    <td className="px-4 py-3 capitalize">{item.status}</td>
                    <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {item.completedAt ? new Date(item.completedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
