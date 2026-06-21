"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchExportJob,
  fetchExportJobs,
  formatApiError,
  requestExport,
  type ExportJobItem,
} from "../api";

type ExportJobsPanelProps = {
  initialJobs: ExportJobItem[];
  canRunExport: boolean;
};

export function ExportJobsPanel({ initialJobs, canRunExport }: ExportJobsPanelProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const refreshJobs = useCallback(async () => {
    const response = await fetchExportJobs();
    setJobs(response.data.items);
  }, []);

  useEffect(() => {
    const pending = jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");
    if (!pending) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshJobs().catch(() => undefined);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [jobs, refreshJobs]);

  async function runExport() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await requestExport(`export-run-${String(Date.now())}`);
      setConfirmOpen(false);
      await refreshJobs();
      setMessage("Export job queued.");
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport(jobId: string) {
    setDownloadingId(jobId);
    setMessage(null);
    setRequestId(null);
    try {
      const response = await fetchExportJob(jobId);
      const download = response.data.download;
      if (!download?.url) {
        setMessage("Download is not available for this export yet.");
        return;
      }
      window.open(download.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Export jobs</h2>
        {canRunExport ? (
          <button
            type="button"
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Run export
          </button>
        ) : null}
      </div>

      {message ? (
        <p role="alert" className="text-sm">
          {message}
          {requestId ? ` Request ID: ${requestId}` : ""}
        </p>
      ) : null}

      {jobs.length === 0 ? (
        <p className="text-sm text-neutral-600">No export jobs yet.</p>
      ) : (
        <div className="space-y-3">
          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.status}</td>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                  <td>
                    {job.status === "SUCCEEDED" ? (
                      <button
                        type="button"
                        disabled={downloadingId === job.id}
                        onClick={() => void downloadExport(job.id)}
                      >
                        {downloadingId === job.id ? "Preparing…" : "Download"}
                      </button>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-3 md:hidden">
            {jobs.map((job) => (
              <article key={job.id} className="rounded border p-3">
                <p>
                  <strong>Status:</strong> {job.status}
                </p>
                <p>
                  <strong>Requested:</strong> {new Date(job.createdAt).toLocaleString()}
                </p>
                {job.status === "SUCCEEDED" ? (
                  <button
                    type="button"
                    className="mt-2"
                    disabled={downloadingId === job.id}
                    onClick={() => void downloadExport(job.id)}
                  >
                    {downloadingId === job.id ? "Preparing…" : "Download"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded bg-white p-6 shadow" role="dialog">
            <h3>Run tenant export?</h3>
            <p>This queues a background export job for tenant-safe data.</p>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                autoFocus
                onClick={() => {
                  setConfirmOpen(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="button" onClick={() => void runExport()} disabled={busy}>
                {busy ? "Queueing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
