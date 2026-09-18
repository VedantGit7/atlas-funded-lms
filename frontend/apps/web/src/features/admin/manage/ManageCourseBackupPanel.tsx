"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
  manageTableCardClassName,
  manageTableHeadClassName,
  manageTableTdClassName,
  manageTableThClassName,
} from "./manage-ui-shared";

type CourseOption = { id: string; title: string };
type ModuleOption = { id: string; title: string };

type CourseBackupJob = {
  id: string;
  courseId: string;
  courseTitle: string;
  status: string;
  downloadUrl?: string | null;
  createdAt: string;
  sectionIds?: string[];
};

type BackupsListResponse = {
  data: { items: CourseBackupJob[] };
};

const DEMO_OTP = "000000";

function formatError(error: unknown): string {
  return error instanceof ClientApiError ? error.message : "Request failed.";
}

function backupStatusTone(status: string): "success" | "primary" | "danger" | "neutral" {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED" || normalized === "SUCCEEDED") return "success";
  if (normalized === "FAILED") return "danger";
  if (normalized === "RUNNING" || normalized === "QUEUED" || normalized === "IN_PROGRESS")
    return "primary";
  return "neutral";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function ManageCourseBackupPanel() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [history, setHistory] = useState<CourseBackupJob[]>([]);
  const [courseId, setCourseId] = useState("");
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await clientApi.get<BackupsListResponse>("/api/v1/manage/course-backups");
      setHistory(response.data.items);
    } catch (caught) {
      if (!(caught instanceof ClientApiError && caught.status === 404)) {
        setError(formatError(caught));
      }
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingCourses(true);
    void clientApi
      .get<{ data: { items: CourseOption[] } }>("/api/v1/courses?view=studio&limit=100")
      .then((response) => {
        if (!cancelled) setCourses(response.data.items);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(formatError(caught));
          setCourses([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  useEffect(() => {
    if (!courseId) {
      setModules([]);
      setSelectedSectionIds(new Set());
      return;
    }

    let cancelled = false;
    setLoadingModules(true);
    void clientApi
      .get<{ data: { items: ModuleOption[] } }>(`/api/v1/courses/${courseId}/modules?view=studio`)
      .then((response) => {
        if (!cancelled) {
          setModules(response.data.items);
          setSelectedSectionIds(new Set());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModules([]);
          setSelectedSectionIds(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModules(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  function toggleSection(sectionId: string) {
    setSelectedSectionIds((previous) => {
      const next = new Set(previous);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  async function sendOtp() {
    setSendingOtp(true);
    setError(null);
    try {
      await clientApi.post("/api/v1/manage/course-backups/request-otp", null, "course-backup-otp", {
        silent: true,
      });
      toast.success("Verification code sent. Use code 000000 for demo.");
      setOtpSent(true);
    } catch (caught) {
      if (caught instanceof ClientApiError && (caught.status === 404 || caught.status === 501)) {
        toast.success("Use code 000000 for demo.");
        setOtpSent(true);
      } else {
        setError(formatError(caught));
      }
    } finally {
      setSendingOtp(false);
    }
  }

  function verifyOtp() {
    if (otpCode.trim() === DEMO_OTP) {
      setOtpVerified(true);
      setError(null);
      toast.success("OTP verified.");
      return;
    }
    setError("Invalid verification code. Use 000000 for demo.");
  }

  async function createBackup() {
    if (!courseId || !otpVerified) return;
    setSubmitting(true);
    setError(null);
    try {
      const sectionIds = selectedSectionIds.size > 0 ? Array.from(selectedSectionIds) : undefined;
      await clientApi.post(
        "/api/v1/manage/course-backups",
        {
          courseId,
          sectionIds,
          otpCode: otpCode.trim() || DEMO_OTP,
        },
        "course-backup-create",
      );
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode("");
      toast.success("Backup created.");
      await loadHistory();
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadBackup(job: CourseBackupJob) {
    if (!job.downloadUrl) return;
    try {
      const response = await clientApi.get<{ data: unknown }>(job.downloadUrl);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `course-backup-${job.courseTitle.replace(/[^\w.-]+/g, "-").toLowerCase()}-${job.id.slice(0, 8)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(formatError(caught));
    }
  }

  const courseOptions = [
    { value: "", label: loadingCourses ? "Loading courses…" : "Select a course" },
    ...courses.map((course) => ({ value: course.id, label: course.title })),
  ];

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      <section className={`${manageTableCardClassName} space-y-4 p-5`}>
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Create backup</h2>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
            Course
          </span>
          <Select
            value={courseId}
            onValueChange={(value) => {
              setCourseId(value);
              setOtpSent(false);
              setOtpVerified(false);
              setOtpCode("");
            }}
            options={courseOptions}
            ariaLabel="Course"
            className="w-full border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
          />
        </label>

        {courseId ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
              Sections{" "}
              {loadingModules ? "(loading…)" : `(optional, ${String(modules.length)} available)`}
            </p>
            {modules.length === 0 && !loadingModules ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No sections found for this course.
              </p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--admin-border)] p-2">
                {modules.map((module) => (
                  <li key={module.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[var(--admin-surface-high)]">
                      <input
                        type="checkbox"
                        checked={selectedSectionIds.has(module.id)}
                        onChange={() => {
                          toggleSection(module.id);
                        }}
                        className="h-4 w-4 accent-[var(--admin-primary)]"
                      />
                      <span className="text-[var(--admin-on-surface)]">{module.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4 space-y-3">
          <p className="text-sm font-medium text-[var(--admin-on-surface)]">OTP verification</p>
          {!otpSent ? (
            <button
              type="button"
              disabled={!courseId || sendingOtp}
              onClick={() => {
                void sendOtp();
              }}
              className={manageSecondaryButtonClassName}
            >
              {sendingOtp ? "Sending…" : "Send OTP"}
            </button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1 text-sm">
                <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                  6-digit code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => {
                    setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  }}
                  placeholder="000000"
                  className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                />
              </label>
              <button
                type="button"
                disabled={otpCode.length !== 6}
                onClick={verifyOtp}
                className={manageSecondaryButtonClassName}
              >
                Verify
              </button>
            </div>
          )}
          {otpVerified ? (
            <p className="text-sm text-[var(--admin-success)]">
              Verified — you can create the backup.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!courseId || !otpVerified || submitting}
          onClick={() => {
            void createBackup();
          }}
          className={managePrimaryButtonClassName}
        >
          {submitting ? "Creating backup…" : "Create backup"}
        </button>
      </section>

      <section className={manageTableCardClassName}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Backup history</h2>
          <button
            type="button"
            disabled={loadingHistory}
            onClick={() => {
              void loadHistory();
            }}
            className={manageSecondaryButtonClassName}
          >
            Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex items-center gap-2 px-4 py-10 text-sm text-[var(--admin-on-surface-variant)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading history…
          </div>
        ) : history.length === 0 ? (
          <p className="px-4 py-10 text-sm text-[var(--admin-on-surface-variant)]">
            No backups yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className={manageTableHeadClassName}>
                  <th className={manageTableThClassName}>Course</th>
                  <th className={manageTableThClassName}>Status</th>
                  <th className={manageTableThClassName}>Created</th>
                  <th className={`${manageTableThClassName} text-right`}>Download</th>
                </tr>
              </thead>
              <tbody>
                {history.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0"
                  >
                    <td className={`${manageTableTdClassName} font-semibold`}>{job.courseTitle}</td>
                    <td className={manageTableTdClassName}>
                      <span className={manageStatusChipClassName(backupStatusTone(job.status))}>
                        {job.status}
                      </span>
                    </td>
                    <td className={manageTableTdClassName}>{formatDate(job.createdAt)}</td>
                    <td className={manageTableTdClassName}>
                      <div className="flex justify-end">
                        {job.downloadUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              void downloadBackup(job);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            Download
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--admin-on-surface-variant)]">—</span>
                        )}
                      </div>
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
