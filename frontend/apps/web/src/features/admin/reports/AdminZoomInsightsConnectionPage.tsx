"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Plug,
  Power,
  RefreshCw,
  Unplug,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  backfillZoomConnection,
  connectZoomAccount,
  dateInputToEndIso,
  dateInputToStartIso,
  disconnectZoomConnection,
  estimateZoomBackfill,
  exportZoomInsightsReport,
  fetchZoomConnectionDetail,
  sendZoomWebhookTest,
  syncZoomConnectionNow,
  updateZoomConnectionSchedule,
  type ZoomConnectionDetail,
  type ZoomSyncPulseCell,
  type ZoomSyncRun,
  type ZoomSyncRunStatus,
  type ZoomSyncTrigger,
  type ZoomWebhookEvent,
} from "./admin-zoom-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { ZoomMeetingsPanel } from "./ZoomMeetingsPanel";

type ModuleTab = "meetings" | "participants" | "unmatched" | "connection" | "exports";

const REQUESTED_SCOPES = ["meeting:read", "user:read", "report:read"] as const;

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerOutlineButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-[color-mix(in_srgb,var(--admin-danger)_45%,var(--admin-border))] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerSolidButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-[var(--admin-danger)] bg-[var(--admin-danger)] px-3 text-[13px] font-semibold text-[var(--admin-on-primary)] transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/40 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "never";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${String(mins)} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${String(hours)} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${String(days)} day${days === 1 ? "" : "s"} ago`;
  return formatDateShort(value);
}

function formatDurationBetween(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";
  const total = Math.floor((end - start) / 1000);
  if (total < 60) return `${String(total)}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return `${String(mins)}m ${String(secs).padStart(2, "0")}s`;
  const hours = Math.floor(mins / 60);
  return `${String(hours)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function formatNextRun(seconds: number | null, at: string | null): string {
  if (seconds == null && !at) return "—";
  if (seconds != null) {
    if (seconds < 60) return "in under a minute";
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `in ${String(mins)} minute${mins === 1 ? "" : "s"}`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `in ${String(hours)} hour${hours === 1 ? "" : "s"}`;
  }
  return at ? formatDateTime(at) : "—";
}

function formatInterval(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `Every ${String(hours)} hour${hours === 1 ? "" : "s"}`;
  }
  return `Every ${String(minutes)} minutes`;
}

function truncateAppId(appId: string | null): string {
  if (!appId) return "—";
  if (appId.length <= 4) return appId;
  return `••••${appId.slice(-4)}`;
}

function tokenExpiresSoon(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return false;
  const expires = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return expires - Date.now() < sevenDays;
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted" | "primary";
  children: ReactNode;
}) {
  const tones = {
    success:
      "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    danger:
      "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    primary:
      "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function syncStatusTone(status: ZoomSyncRunStatus): "success" | "warning" | "danger" | "muted" {
  if (status === "completed") return "success";
  if (status === "partial" || status === "running") return "warning";
  return "danger";
}

function triggerLabel(trigger: ZoomSyncTrigger): string {
  if (trigger === "manual") return "Manual";
  if (trigger === "scheduled") return "Scheduled";
  if (trigger === "webhook") return "Webhook";
  return "Backfill";
}

function ModuleTabs({ active }: { active: ModuleTab }) {
  const router = useRouter();
  const tabs: Array<[ModuleTab, string, string]> = [
    ["meetings", "Meetings", "/admin/reports/zoom-insights"],
    ["participants", "Participants", "/admin/reports/zoom-insights/participants"],
    ["unmatched", "Unmatched", "/admin/reports/zoom-insights/unmatched"],
    ["connection", "Connection", "/admin/reports/zoom-insights/connection"],
    ["exports", "Exports", "/admin/reports/zoom-insights/exports"],
  ];
  return (
    <div className="flex gap-6 border-b border-[var(--admin-border)]" role="tablist">
      {tabs.map(([value, label, href]) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={[
              "px-1 pb-2 text-base font-semibold transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => {
              router.push(href);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]",
      ].join(" ")}
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--admin-surface)] shadow transition duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function SyncPulseStrip({ cells }: { cells: ZoomSyncPulseCell[] }) {
  const failedCount = cells.filter((cell) => cell.status === "failed").length;
  return (
    <div className="space-y-2">
      <div
        className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-0.5"
        role="img"
        aria-label={`Sync pulse for ${String(cells.length)} recent runs, ${String(failedCount)} failed`}
      >
        {cells.map((cell) => {
          const tone =
            cell.status === "success"
              ? "bg-[var(--admin-success)]"
              : cell.status === "partial"
                ? "bg-[var(--admin-warning)]"
                : cell.status === "failed"
                  ? "bg-[var(--admin-danger)]"
                  : "border border-[var(--admin-border)] bg-transparent";
          return (
            <span
              key={cell.index}
              className={`aspect-square min-h-[6px] rounded-[1px] ${tone}`}
              title={cell.status}
            />
          );
        })}
      </div>
      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        {formatCount(failedCount)} failed run{failedCount === 1 ? "" : "s"} in the last 60 cells
      </p>
    </div>
  );
}

function ConnectionLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-5 w-40" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Shimmer className="h-80 w-full rounded-lg" />
        <div className="space-y-4">
          <Shimmer className="h-36 w-full rounded-lg" />
          <Shimmer className="h-48 w-full rounded-lg" />
          <Shimmer className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  open,
  title,
  titleId,
  onClose,
  children,
  busy,
}: {
  open: boolean;
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[2px]"
        aria-label="Close dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-4">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function BackfillModal({
  open,
  onClose,
  busy,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onStart: (input: {
    rangeFrom: string;
    rangeTo: string;
    skipAlreadyImported: boolean;
  }) => Promise<void>;
}) {
  const titleId = useId();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultFrom = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  }, []);
  const [rangeFrom, setRangeFrom] = useState(defaultFrom);
  const [rangeTo, setRangeTo] = useState(today);
  const [skipAlreadyImported, setSkipAlreadyImported] = useState(true);
  const [estimate, setEstimate] = useState<{
    estimatedMeetings: number;
    estimatedParticipants: number;
  } | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRangeFrom(defaultFrom);
    setRangeTo(today);
    setSkipAlreadyImported(true);
    setEstimate(null);
    setEstimateError(null);
  }, [open, defaultFrom, today]);

  useEffect(() => {
    if (!open) return;
    const fromIso = dateInputToStartIso(rangeFrom);
    const toIso = dateInputToEndIso(rangeTo);
    if (!fromIso || !toIso) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setEstimating(true);
        setEstimateError(null);
        try {
          const response = await estimateZoomBackfill(fromIso, toIso);
          if (!cancelled) setEstimate(response.data);
        } catch (err) {
          if (!cancelled) {
            setEstimate(null);
            setEstimateError(
              err instanceof ClientApiError ? err.message : "Unable to estimate backfill.",
            );
          }
        } finally {
          if (!cancelled) setEstimating(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, rangeFrom, rangeTo]);

  return (
    <ModalShell
      open={open}
      title="Backfill meetings"
      titleId={titleId}
      onClose={onClose}
      busy={busy}
    >
      <div className="space-y-5 px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              From
            </span>
            <input
              type="date"
              className={fieldClassName}
              value={rangeFrom}
              max={rangeTo}
              onChange={(event) => {
                setRangeFrom(event.target.value);
              }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              To
            </span>
            <input
              type="date"
              className={fieldClassName}
              value={rangeTo}
              min={rangeFrom}
              max={today}
              onChange={(event) => {
                setRangeTo(event.target.value);
              }}
            />
          </label>
        </div>

        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {estimating
            ? "Estimating…"
            : estimate
              ? `About ${formatCount(estimate.estimatedMeetings)} meetings and ${formatCount(estimate.estimatedParticipants)} participant records.`
              : (estimateError ?? "Select a date range to estimate work.")}
        </p>

        <label className="flex items-start gap-3 text-sm text-[var(--admin-on-surface)]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)] focus-visible:ring-[var(--admin-primary)]"
            checked={skipAlreadyImported}
            onChange={(event) => {
              setSkipAlreadyImported(event.target.checked);
            }}
          />
          <span>Skip meetings already imported</span>
        </label>

        <div className="flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-3 text-[var(--admin-warning)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-xs">
            Zoom API rate limits may make this run take several minutes for large ranges.
          </p>
        </div>
      </div>
      <footer className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${primaryButtonClassName} h-9 px-4`}
          disabled={busy || !rangeFrom || !rangeTo}
          onClick={() => {
            const fromIso = dateInputToStartIso(rangeFrom);
            const toIso = dateInputToEndIso(rangeTo);
            if (!fromIso || !toIso) return;
            void onStart({
              rangeFrom: fromIso,
              rangeTo: toIso,
              skipAlreadyImported,
            });
          }}
        >
          {busy ? "Starting…" : "Start backfill"}
        </button>
      </footer>
    </ModalShell>
  );
}

function DisconnectModal({
  open,
  onClose,
  busy,
  connection,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  connection: ZoomConnectionDetail;
  onConfirm: (confirmation: string) => Promise<void>;
}) {
  const titleId = useId();
  const [confirmation, setConfirmation] = useState("");
  const confirmTarget = connection.accountEmail?.trim() || connection.accountId?.trim() || "";
  const confirmKind = connection.accountEmail?.trim()
    ? "account email"
    : connection.accountId?.trim()
      ? "account ID"
      : "confirmation value";
  const matches =
    confirmTarget.length > 0 && confirmation.trim().toLowerCase() === confirmTarget.toLowerCase();

  useEffect(() => {
    if (open) setConfirmation("");
  }, [open]);

  return (
    <ModalShell open={open} title="Disconnect Zoom" titleId={titleId} onClose={onClose} busy={busy}>
      <div className="space-y-4 px-6 py-5">
        <p className="text-sm text-[var(--admin-on-surface)]">
          Disconnect{" "}
          <span className="font-semibold">
            {connection.accountName ?? connection.accountEmail ?? "this Zoom account"}
          </span>
          ?
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--admin-on-surface-variant)]">
          <li>Already-imported meetings and participants stay readable.</li>
          <li>No new Zoom data will arrive until you reconnect.</li>
          <li>Reconnecting the same account resumes where it left off.</li>
        </ul>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Type the {confirmKind} to confirm
          </span>
          <input
            type="text"
            className={fieldClassName}
            value={confirmation}
            autoComplete="off"
            spellCheck={false}
            placeholder={confirmTarget || "Confirmation value"}
            onChange={(event) => {
              setConfirmation(event.target.value);
            }}
          />
        </label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={dangerSolidButtonClassName}
          disabled={busy || !matches}
          onClick={() => void onConfirm(confirmation.trim())}
        >
          {busy ? "Disconnecting…" : "Disconnect Zoom"}
        </button>
      </footer>
    </ModalShell>
  );
}

function SyncLogModal({
  open,
  onClose,
  run,
}: {
  open: boolean;
  onClose: () => void;
  run: ZoomSyncRun | null;
}) {
  const titleId = useId();
  return (
    <ModalShell open={open && run != null} title="Sync log" titleId={titleId} onClose={onClose}>
      {run ? (
        <div className="space-y-3 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
            <span className="font-mono">{formatRelative(run.startedAt)}</span>
            <span>·</span>
            <StatusPill tone={syncStatusTone(run.status)}>{run.status}</StatusPill>
            <span>·</span>
            <span>{triggerLabel(run.trigger)}</span>
          </div>
          <pre className="max-h-[320px] overflow-auto rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 font-mono text-xs leading-relaxed text-[var(--admin-on-surface)]">
            {run.logLines.length > 0 ? run.logLines.join("\n") : "No log lines recorded."}
          </pre>
        </div>
      ) : null}
      <footer className="flex justify-end border-t border-[var(--admin-border)] px-6 py-4">
        <button type="button" className={secondaryButtonClassName} onClick={onClose}>
          Close
        </button>
      </footer>
    </ModalShell>
  );
}

function NeverConnectedPanel({ busy, onConnect }: { busy: boolean; onConnect: () => void }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="flex w-full max-w-md flex-col items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
          <Plug
            className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <h2 className="mb-2 text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
          Connect a Zoom account
        </h2>
        <p className="mb-2 max-w-[320px] text-sm text-[var(--admin-on-surface-variant)]">
          Import completed meetings and participant attendance so Zoom Insights can reconcile
          coverage in this academy.
        </p>
        <p className="mb-6 max-w-[320px] text-sm text-[var(--admin-on-surface-variant)]">
          Connecting requests read-only Zoom scopes. You can disconnect at any time.
        </p>
        <ul className="mb-8 w-full space-y-2 text-left">
          {REQUESTED_SCOPES.map((scope) => (
            <li
              key={scope}
              className="flex items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 font-mono text-[13px] text-[var(--admin-on-surface)]"
            >
              <Power
                className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              {scope}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${primaryButtonClassName} h-11 px-6`}
          disabled={busy}
          onClick={onConnect}
        >
          Connect Zoom
        </button>
      </div>
    </div>
  );
}

function AccountDetailsPanel({
  connection,
  muted,
  onCopyAccountId,
  copied,
}: {
  connection: ZoomConnectionDetail;
  muted?: boolean;
  onCopyAccountId: () => void;
  copied: boolean;
}) {
  const scopes = connection.scopes.length > 0 ? connection.scopes : [...REQUESTED_SCOPES];
  const expirySoon = tokenExpiresSoon(connection.tokenExpiresAt);

  return (
    <section
      className={[
        "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6",
        muted ? "opacity-70 grayscale" : "",
      ].join(" ")}
    >
      <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Account details</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Status
          </dt>
          <dd className="mt-1.5">
            <StatusPill
              tone={
                connection.status === "connected"
                  ? "success"
                  : connection.status === "disconnected"
                    ? "danger"
                    : "warning"
              }
            >
              {connection.status}
            </StatusPill>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Account
          </dt>
          <dd className="mt-1.5 text-sm text-[var(--admin-on-surface)]">
            {connection.accountName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Email
          </dt>
          <dd className="mt-1.5 font-mono text-sm text-[var(--admin-on-surface)]">
            {connection.accountEmail ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Connected on
          </dt>
          <dd className="mt-1.5 font-mono text-sm text-[var(--admin-on-surface)]">
            {formatDateShort(connection.connectedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Account ID
          </dt>
          <dd className="mt-1.5 flex items-center gap-2 font-mono text-sm text-[var(--admin-on-surface)]">
            <span className="truncate">{connection.accountId ?? "—"}</span>
            {connection.accountId ? (
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                aria-label={copied ? "Account ID copied" : "Copy account ID"}
                onClick={onCopyAccountId}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            App ID
          </dt>
          <dd className="mt-1.5 font-mono text-sm text-[var(--admin-on-surface)]">
            {truncateAppId(connection.appId)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Scopes
          </dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {scopes.map((scope) => (
              <span
                key={scope}
                className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface)]"
              >
                {scope}
              </span>
            ))}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Token expiry
          </dt>
          <dd className="mt-1.5 font-mono text-sm text-[var(--admin-on-surface)]">
            {formatDateTime(connection.tokenExpiresAt)}
          </dd>
          {expirySoon ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--admin-warning)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Token expires within 7 days. Reconnect if syncs start failing.
            </p>
          ) : null}
          {connection.status === "disconnected" && connection.disconnectedAt ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--admin-danger)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Disconnected on {formatDateShort(connection.disconnectedAt)}.
            </p>
          ) : null}
        </div>
      </dl>
    </section>
  );
}

export function AdminZoomInsightsConnectionPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ZoomConnectionDetail | null>(null);
  const [syncPulse, setSyncPulse] = useState<ZoomSyncPulseCell[]>([]);
  const [syncRuns, setSyncRuns] = useState<ZoomSyncRun[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<ZoomWebhookEvent[]>([]);
  const [lastWebhookAt, setLastWebhookAt] = useState<string | null>(null);

  const [backfillOpen, setBackfillOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [logRun, setLogRun] = useState<ZoomSyncRun | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchZoomConnectionDetail();
      setConnection(response.data.connection);
      setSyncPulse(response.data.syncPulse);
      setSyncRuns(response.data.syncRuns);
      setWebhookEvents(response.data.webhookEvents);
      setLastWebhookAt(response.data.lastWebhookAt);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load Zoom connection.",
      );
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const neverConnected =
    connection != null &&
    (!connection.hasConnectionRecord || (connection.status === "unknown" && connection.id == null));

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1500);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const queued = await exportZoomInsightsReport({ emailDownloadLink: true });
      const run = await pollReportRunUntilComplete(queued.data.runId);
      if (run.status === "failed") {
        throw new Error(run.errorMessage ?? "Export failed.");
      }
      if (run.status === "completed") {
        await downloadReportExport(run.id, "csv");
      }
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      await connectZoomAccount({});
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to connect Zoom.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    setError(null);
    try {
      const response = await syncZoomConnectionNow();
      setSyncRuns((current) => [response.data.run, ...current].slice(0, 25));
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to sync Zoom.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleBackfill(input: {
    rangeFrom: string;
    rangeTo: string;
    skipAlreadyImported: boolean;
  }) {
    setBusy(true);
    setError(null);
    try {
      const response = await backfillZoomConnection(input);
      setSyncRuns((current) => [response.data.run, ...current].slice(0, 25));
      setBackfillOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to start backfill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect(confirmation: string) {
    setBusy(true);
    setError(null);
    try {
      await disconnectZoomConnection(confirmation);
      setDisconnectOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to disconnect Zoom.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleScheduleToggle(nextEnabled: boolean) {
    if (!connection) return;
    setBusy(true);
    setError(null);
    try {
      const response = await updateZoomConnectionSchedule({
        scheduleEnabled: nextEnabled,
        scheduleIntervalMinutes: connection.scheduleIntervalMinutes,
      });
      setConnection({
        ...connection,
        scheduleEnabled: response.data.scheduleEnabled,
        scheduleIntervalMinutes: response.data.scheduleIntervalMinutes,
        nextRunAt: response.data.nextRunAt,
        nextRunInSeconds: response.data.nextRunInSeconds,
      });
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to update schedule.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleWebhookTest() {
    setBusy(true);
    setError(null);
    try {
      const response = await sendZoomWebhookTest();
      setWebhookEvents((current) => [response.data.event, ...current].slice(0, 12));
      setLastWebhookAt(response.data.event.receivedAt);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to send test webhook.",
      );
    } finally {
      setBusy(false);
    }
  }

  const recentWebhookEvents = webhookEvents.slice(0, 5);
  const tableRuns = syncRuns.slice(0, 10);
  const isDisconnected = connection?.status === "disconnected";
  const isConnected = connection?.status === "connected";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav className="text-sm text-[var(--admin-on-surface-variant)]">
        <Link href="/admin/reports" className="hover:underline">
          Reports
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/reports/zoom-insights" className="hover:underline">
          Zoom Insights
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--admin-on-surface)]">Connection</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Connection
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            The Zoom account this report reads from, and the health of the data coming out of it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isConnected ? (
            <>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy || loading}
                onClick={() => void handleSyncNow()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Sync now
              </button>
              <button
                type="button"
                className={dangerOutlineButtonClassName}
                disabled={busy || loading}
                onClick={() => {
                  setDisconnectOpen(true);
                }}
              >
                <Unplug className="h-4 w-4" aria-hidden="true" />
                Disconnect
              </button>
            </>
          ) : null}
          {isDisconnected || neverConnected ? (
            <button
              type="button"
              className={`${primaryButtonClassName} h-9 px-4`}
              disabled={busy || loading}
              onClick={() => void handleConnect()}
            >
              {isDisconnected ? "Reconnect Zoom" : "Connect Zoom"}
            </button>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <ModuleTabs active="connection" />

      {error ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
          <p className="font-semibold text-[var(--admin-danger)]">{error}</p>
          <button
            type="button"
            className={`${secondaryButtonClassName} mt-3`}
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <ConnectionLoadingSkeleton /> : null}

      {!loading && neverConnected ? (
        <NeverConnectedPanel busy={busy} onConnect={() => void handleConnect()} />
      ) : null}

      {!loading && connection && !neverConnected ? (
        <>
          {isConnected ? (
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                <span className="inline-flex h-2 w-2 rounded-full bg-[var(--admin-success)]" />
                <span className="font-semibold">Zoom connected</span>
                <span className="text-[var(--admin-on-surface-variant)]">·</span>
                <span className="text-[var(--admin-on-surface-variant)]">
                  last synced {formatRelative(connection.lastSyncedAt)}
                </span>
                <span className="text-[var(--admin-on-surface-variant)]">·</span>
                <span className="text-[var(--admin-on-surface-variant)]">
                  {formatCount(connection.meetingsImportedToday)} meeting
                  {connection.meetingsImportedToday === 1 ? "" : "s"} imported today
                </span>
              </div>
            </div>
          ) : null}

          {isDisconnected ? (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
              <p className="font-semibold text-[var(--admin-danger)]">Zoom is disconnected</p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Last synced {formatRelative(connection.lastSyncedAt)}. Reconnect to resume imports.
              </p>
              <button
                type="button"
                className={`${primaryButtonClassName} mt-3 h-9 px-4`}
                disabled={busy}
                onClick={() => void handleConnect()}
              >
                Reconnect Zoom
              </button>
            </div>
          ) : null}

          <AccountDetailsPanel
            connection={connection}
            muted={isDisconnected}
            copied={copiedKey === "accountId"}
            onCopyAccountId={() => {
              if (connection.accountId) void copyText("accountId", connection.accountId);
            }}
          />

          <div
            className={[
              "grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]",
              isDisconnected ? "opacity-80" : "",
            ].join(" ")}
          >
            <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Sync history
                  </h2>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    Recent import runs and outcomes.
                  </p>
                </div>
                {isDisconnected ? <StatusPill tone="muted">Stale sync health</StatusPill> : null}
              </div>

              <SyncPulseStrip cells={syncPulse} />

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      <th className="px-2 py-2 font-semibold">Started</th>
                      <th className="px-2 py-2 font-semibold">Trigger</th>
                      <th className="px-2 py-2 font-semibold">Meetings</th>
                      <th className="px-2 py-2 font-semibold">Participants</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Log</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRuns.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-2 py-8 text-center text-[var(--admin-on-surface-variant)]"
                        >
                          No sync runs yet.
                        </td>
                      </tr>
                    ) : (
                      tableRuns.map((run) => (
                        <tr
                          key={run.id}
                          className="border-b border-[var(--admin-border)] last:border-b-0"
                        >
                          <td className="px-2 py-3 align-top">
                            <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                              {formatRelative(run.startedAt)}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              {formatDateTime(run.startedAt)}
                              {run.finishedAt
                                ? ` · ${formatDurationBetween(run.startedAt, run.finishedAt)}`
                                : ""}
                            </div>
                          </td>
                          <td className="px-2 py-3 align-top">
                            <StatusPill tone="muted">{triggerLabel(run.trigger)}</StatusPill>
                          </td>
                          <td className="px-2 py-3 align-top font-mono text-[13px]">
                            {formatCount(run.meetingsCount)}
                          </td>
                          <td className="px-2 py-3 align-top font-mono text-[13px]">
                            {formatCount(run.participantsCount)}
                          </td>
                          <td className="px-2 py-3 align-top">
                            <StatusPill tone={syncStatusTone(run.status)}>{run.status}</StatusPill>
                            {run.status === "partial" && run.skippedCount > 0 ? (
                              <p className="mt-1 text-xs text-[var(--admin-warning)]">
                                Skipped {formatCount(run.skippedCount)}
                              </p>
                            ) : null}
                            {run.status === "failed" && run.errorMessage ? (
                              <p className="mt-1 line-clamp-1 text-xs text-[var(--admin-danger)]">
                                {run.errorMessage}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3 align-top">
                            <button
                              type="button"
                              className="text-[13px] font-semibold text-[var(--admin-primary)] hover:underline"
                              onClick={() => {
                                setLogRun(run);
                              }}
                            >
                              View log
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Coverage</h3>
                <p className="mt-3 text-sm text-[var(--admin-on-surface)]">
                  {formatCount(connection.meetingsImported)} meetings imported
                  {connection.coverageGapCount > 0 ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-[var(--admin-warning)]">
                        {formatCount(connection.coverageGapCount)} meeting
                        {connection.coverageGapCount === 1 ? "" : "s"} reported by Zoom but not
                        imported
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--admin-on-surface-variant)]">
                      {" "}
                      · no coverage gaps reported
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                  Zoom omits participant reports for meetings under a minute.
                </p>
              </section>

              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Webhooks</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Endpoint
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2 py-1.5 font-mono text-[12px] text-[var(--admin-on-surface)]">
                        {connection.webhookEndpoint}
                      </code>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                        aria-label={
                          copiedKey === "webhook" ? "Endpoint copied" : "Copy webhook endpoint"
                        }
                        onClick={() => void copyText("webhook", connection.webhookEndpoint)}
                      >
                        {copiedKey === "webhook" ? (
                          <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Signing secret
                    </p>
                    <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
                      {connection.webhookSecretMasked ??
                        (connection.hasWebhookSecret ? "•••••••••••••••" : "Not configured")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Last event
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface)]">
                      {lastWebhookAt ? formatRelative(lastWebhookAt) : "No events yet"}
                    </p>
                  </div>
                  {recentWebhookEvents.length > 0 ? (
                    <ul className="space-y-2 border-t border-[var(--admin-border)] pt-3">
                      {recentWebhookEvents.map((event) => (
                        <li
                          key={event.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[var(--admin-on-surface)]">
                              {event.eventType}
                            </span>
                            {event.topic ? (
                              <span className="ml-2 text-[var(--admin-on-surface-variant)]">
                                {event.topic}
                              </span>
                            ) : null}
                          </div>
                          <StatusPill
                            tone={
                              event.statusCode >= 200 && event.statusCode < 300
                                ? "success"
                                : "danger"
                            }
                          >
                            {event.statusCode}
                          </StatusPill>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={busy || isDisconnected}
                    onClick={() => void handleWebhookTest()}
                  >
                    Send test event
                  </button>
                </div>
              </section>

              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Schedule</h3>
                <p className="mt-3 text-sm text-[var(--admin-on-surface)]">
                  {formatInterval(connection.scheduleIntervalMinutes)}
                </p>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Next run{" "}
                  {connection.scheduleEnabled
                    ? formatNextRun(connection.nextRunInSeconds, connection.nextRunAt)
                    : "paused"}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={busy || !isConnected}
                    onClick={() => {
                      setBackfillOpen(true);
                    }}
                  >
                    Backfill
                  </button>
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Automatic syncing
                    </p>
                    {!connection.scheduleEnabled ? (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-[var(--admin-warning)]">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Automatic syncing is paused.
                      </p>
                    ) : null}
                  </div>
                  <ScheduleToggle
                    checked={connection.scheduleEnabled}
                    disabled={busy || !isConnected}
                    label="Automatic syncing"
                    onChange={(next) => void handleScheduleToggle(next)}
                  />
                </div>
              </section>
            </div>
          </div>

          <div className="mt-6">
            <ZoomMeetingsPanel />
          </div>
        </>
      ) : null}

      {connection ? (
        <>
          <BackfillModal
            open={backfillOpen}
            onClose={() => {
              setBackfillOpen(false);
            }}
            busy={busy}
            onStart={handleBackfill}
          />
          <DisconnectModal
            open={disconnectOpen}
            onClose={() => {
              setDisconnectOpen(false);
            }}
            busy={busy}
            connection={connection}
            onConfirm={handleDisconnect}
          />
        </>
      ) : null}

      <SyncLogModal
        open={logRun != null}
        onClose={() => {
          setLogRun(null);
        }}
        run={logRun}
      />
    </div>
  );
}
