"use client";

import { useCallback, useEffect, useState } from "react";
import {
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { generalSettingsFormCardClassName } from "../general-settings/general-settings-shared";
import {
  createBiExportJob,
  fetchBiExportJobs,
  type BiExportJob,
} from "./admin-reports-api";
import { APPROVED_REPORT_DATASETS } from "./report-dataset-catalog";

export function BiExportPanel() {
  const [datasetKey, setDatasetKey] = useState(APPROVED_REPORT_DATASETS[0]?.key ?? "enrollments");
  const [format, setFormat] = useState<"csv" | "jsonl">("csv");
  const [jobs, setJobs] = useState<BiExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBiExportJobs();
      setJobs(response.data.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load BI exports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function handleRequest() {
    setRequesting(true);
    setError(null);
    try {
      await createBiExportJob({ datasetKey, format });
      await loadJobs();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request BI drop.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section className={generalSettingsFormCardClassName} aria-labelledby="bi-export-heading">
      <h2 id="bi-export-heading" className="text-lg font-semibold text-[var(--admin-on-surface)]">
        BI data drops
      </h2>
      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
        Request a CSV or JSONL snapshot of an approved dataset to R2 for downstream BI tools.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="block min-w-[220px] text-sm">
          <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">Dataset</span>
          <select
            className={fieldClassName}
            value={datasetKey}
            onChange={(event) => setDatasetKey(event.target.value)}
          >
            {APPROVED_REPORT_DATASETS.map((dataset) => (
              <option key={dataset.key} value={dataset.key}>
                {dataset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[160px] text-sm">
          <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">Format</span>
          <select
            className={fieldClassName}
            value={format}
            onChange={(event) => setFormat(event.target.value as "csv" | "jsonl")}
          >
            <option value="csv">CSV</option>
            <option value="jsonl">JSONL</option>
          </select>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={requesting}
            onClick={() => void handleRequest()}
          >
            {requesting ? "Requesting…" : "Request BI drop"}
          </button>
          <button type="button" className={ghostButtonClassName} disabled={loading} onClick={() => void loadJobs()}>
            Refresh
          </button>
        </div>
      </div>

      <div className={`${analyticsTableShellClassName} mt-6`}>
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Dataset</th>
              <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Format</th>
              <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Status</th>
              <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Requested</th>
              <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Download</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                  {loading ? "Loading…" : "No BI drops yet."}
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className={analyticsTableRowClassName}>
                  <td className="px-4 py-3">{job.datasetKey}</td>
                  <td className="px-4 py-3 uppercase">{job.format}</td>
                  <td className="px-4 py-3 capitalize">{job.status}</td>
                  <td className="px-4 py-3">{new Date(job.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {job.downloadUrl ? (
                      <a
                        href={job.downloadUrl}
                        className="text-[var(--admin-primary)] underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
