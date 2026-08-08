"use client";

import { useMemo, useState } from "react";
import {
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { generalSettingsFormCardClassName } from "../general-settings/general-settings-shared";
import {
  createCustomReportDefinition,
  startReportRun,
  type CustomReportDefinition,
} from "./admin-reports-api";
import {
  APPROVED_REPORT_DATASETS,
  getColumnsForDataset,
} from "./report-dataset-catalog";

type CustomReportBuilderProps = {
  onSaved?: (definition: CustomReportDefinition) => void;
  onRunStarted?: (runId: string, definitionKey: string) => void;
};

export function CustomReportBuilder({ onSaved, onRunStarted }: CustomReportBuilderProps) {
  const [datasetKey, setDatasetKey] = useState(APPROVED_REPORT_DATASETS[0]?.key ?? "enrollments");
  const [title, setTitle] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [savedDefinition, setSavedDefinition] = useState<CustomReportDefinition | null>(null);
  const [busy, setBusy] = useState<"save" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const columnOptions = useMemo(() => getColumnsForDataset(datasetKey), [datasetKey]);

  function toggleColumn(column: string) {
    setSelectedColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  function selectAllColumns() {
    setSelectedColumns(columnOptions.map((column) => column.key));
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Report title is required.");
      return;
    }
    if (selectedColumns.length === 0) {
      setError("Select at least one column.");
      return;
    }

    setBusy("save");
    setError(null);
    setMessage(null);

    try {
      const response = await createCustomReportDefinition({
        title: title.trim(),
        datasetKey,
        columns: selectedColumns,
      });
      setSavedDefinition(response.data);
      setMessage(`Saved custom report "${response.data.title}".`);
      onSaved?.(response.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save custom report.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRun() {
    const definitionKey = savedDefinition?.key;
    if (!definitionKey) {
      setError("Save the custom report before running.");
      return;
    }

    setBusy("run");
    setError(null);

    try {
      const response = await startReportRun(definitionKey, {});
      onRunStarted?.(response.data.id, definitionKey);
      setMessage("Report run started.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run custom report.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={generalSettingsFormCardClassName} aria-labelledby="custom-report-builder-heading">
      <h2 id="custom-report-builder-heading" className="text-lg font-semibold text-[var(--admin-on-surface)]">
        Custom report builder
      </h2>
      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
        Pick an approved dataset, choose columns, save a tenant-scoped definition, and run it.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">Dataset</span>
          <select
            className={fieldClassName}
            value={datasetKey}
            onChange={(event) => {
              setDatasetKey(event.target.value);
              setSelectedColumns([]);
              setSavedDefinition(null);
            }}
          >
            {APPROVED_REPORT_DATASETS.map((dataset) => (
              <option key={dataset.key} value={dataset.key}>
                {dataset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">Report title</span>
          <input
            className={fieldClassName}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Monthly enrollment extract"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[var(--admin-on-surface-variant)]">Columns</span>
          <button type="button" className={ghostButtonClassName} onClick={selectAllColumns}>
            Select all
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {columnOptions.map((column) => (
            <label key={column.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedColumns.includes(column.key)}
                onChange={() => toggleColumn(column.key)}
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={busy !== null}
          onClick={() => void handleSave()}
        >
          {busy === "save" ? "Saving…" : "Save definition"}
        </button>
        <button
          type="button"
          className={ghostButtonClassName}
          disabled={busy !== null || !savedDefinition}
          onClick={() => void handleRun()}
        >
          {busy === "run" ? "Running…" : "Run saved report"}
        </button>
      </div>
    </section>
  );
}
